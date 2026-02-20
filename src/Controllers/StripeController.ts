import { AppDataSource } from './../data-source';
// Remove: import { Request } from 'express';
import { Body, CurrentUser, Delete, Get, JsonController, Param, Patch, Post, Put, QueryParam, Req, Res } from 'routing-controllers';
import { BillingPlan } from '../entity/BillingPlan';
import { User } from '../entity/User';
import { UserPackageSelection } from '../entity/UserPackageSelection';
import { env } from 'process';

const Stripe = require('stripe');
// Socket.IO global getter
import { getIO } from '../socket';

@JsonController()
export default class StripeController {
    /**
     * Create a new icon for a billing plan
     * POST /billing/icons
     * Body: { label: string, key: string, imageUrl: string, planId: number }

    */
  //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
  private getStripe(): any {
    const key = "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";
    if (!key) {
      throw new Error('Stripe secret key is not configured');
    }
    return new Stripe(key, { apiVersion: '2024-06-20' });
  }

  /**
   * Get Stripe customers subscribed to a specific plan (price)
   */
  @Get('/stripe/customers/plan/:planId')
  async getStripeCustomersForPlan(
    @Param('planId') planId: string,
    @Res() res: any
  ) {
    try {
      const stripe = this.getStripe();
      // Fetch all subscriptions (up to 100)
      const subscriptions = await stripe.subscriptions.list({ limit: 100 });
      // Filter subscriptions for the planId (price)
      const filtered = subscriptions.data.filter(sub =>
        sub.items.data.some(item => item.price.id === planId)
      );
      // Collect customer details
      const customers = [];
      for (const sub of filtered) {
        const customer = await stripe.customers.retrieve(sub.customer);
        customers.push({
          username: customer.name || customer.email,
          email: customer.email,
          first_name: customer.name ? customer.name.split(' ')[0] : '',
          last_name: customer.name ? customer.name.split(' ').slice(1).join(' ') : '',
          stripeCustomerId: customer.id,
          subscriptionId: sub.id
        });
      }
      return res.status(200).json(customers);
    } catch (error: any) {
      console.error('Stripe fetch error:', error);
      return res.status(500).json({ error: 'Napaka pri nalaganju Stripe strank.' });
    }
  }


  /**
   * Get all Stripe prices (with product info)
   */
  @Get('/stripe/prices')
  async getStripePrices(@Res() res: any) {
    try {
      const stripe = this.getStripe();
      const prices = await stripe.prices.list({ limit: 100, expand: ['data.product'] });
      return res.status(200).json(prices.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }
  


  /**
   * Get all Stripe products (sandbox)
   */
  @Get('/stripe/products')
  async getStripeProducts(@Res() res: any) {
    try {
      const stripe = this.getStripe();
      // Fetch all products from Stripe (sandbox)
      const products = await stripe.products.list({ limit: 100 });
      return res.status(200).json(products.data);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Get('/billing/plans/:planId/users')
  async getUsersByPlan(
    @Param('planId') planId: number,
    @Res() res: any
  ) {
    try {
      // Users with fk_billing_plan_id = planId, always join profileImage
      const userRepo = AppDataSource.getRepository(User);
      const directUsers = await userRepo
        .createQueryBuilder('U')
        .leftJoinAndSelect('U.profileImage', 'profileImage')
        .where('U.fk_billing_plan_id = :planId', { planId })
        .skip(0)
        .take(20)
        .getMany();

      // Users with a UserPackageSelection for this plan
      const upsRepo = AppDataSource.getRepository(UserPackageSelection);
      const selections = await upsRepo.find({ where: { fk_billing_id: { id: planId } }, relations: ['fk_user_id', 'fk_user_id.profileImage'] });
      const selectionUsers = selections.map(sel => sel.fk_user_id).filter(Boolean);

      // Merge and deduplicate users by id, return full User entity with image path or default
      const allUsersMap = new Map();
      for (const u of [...directUsers, ...selectionUsers]) {
        if (u && u.id) {
          let profile_image_url = null;
          if (u.profileImage && typeof u.profileImage === 'object' && u.profileImage.path) {
            if (/^https?:\/\//.test(u.profileImage.path)) {
              profile_image_url = u.profileImage.path;
            } else if (u.profileImage.path.startsWith('/uploads/profiles/')) {
              profile_image_url = `${process.env.SERVER_URL || ''}${u.profileImage.path}`;
            } else {
              profile_image_url = `${process.env.SERVER_URL || ''}/uploads/profiles/${u.profileImage.path}`;
            }
          } else {
            profile_image_url = '/public/images/avatar.jpg';
          }
          allUsersMap.set(u.id, {
            ...u,
            profile_image_url
          });
        }
      }
      return res.status(200).json(Array.from(allUsersMap.values()));
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  /**
   * Get the latest UserPackageSelection for a user
   * GET /user-package-selection/user/:userId
   */
  @Get('/user-package-selection/user/:userId')
  async getUserPackageSelectionByUser(@Param('userId') userId: number, @Res() res: any) {
    try {
      const upsRepo = AppDataSource.getRepository(require('../entity/UserPackageSelection').UserPackageSelection);
      // Get the most recent selection for the user (assuming higher id = more recent)
      const selections = await upsRepo.find({
        where: { fk_user_id: { id: userId } },
        relations: ['fk_billing_id', 'fk_icons_id'],
        order: { id: 'DESC' }
      });
      return res.status(200).json(selections);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Get('/billing/plans')
  async listPlans(
    @QueryParam('includeInactive') includeInactive: string | boolean,
    @Res() res: any
  ) {
    try {
      const query = AppDataSource.getRepository(BillingPlan)
        .createQueryBuilder('P')
        .orderBy('P.amount_minor', 'ASC');

      if (!(includeInactive === true || includeInactive === '1' || includeInactive === 'true')) {
        query.where('P.active = 1');
      }

      const plans = await query.skip(0).take(20).getMany();

      return res.status(200).json(plans);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Get('/billing/current')
  async getCurrentPlan(@CurrentUser() user: User | null, @Res() res: any) {
    try {
      if (!user?.id) return res.status(401).json({ message: 'Unauthorized' });
      const current = await AppDataSource.getRepository(User)
        .createQueryBuilder('U')
        .leftJoinAndSelect('U.fk_billing_plan_id', 'Plan')
        .where('U.id = :id', { id: user.id })
        .getOne();

      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name
        },
        billingPlan: current?.fk_billing_plan_id || null,
        selectedPlan: current?.fk_billing_plan_id ? {
          id: current.fk_billing_plan_id.id,
          name: current.fk_billing_plan_id.name,
          slug: current.fk_billing_plan_id.slug,
          description: current.fk_billing_plan_id.description,
          amount_minor: current.fk_billing_plan_id.amount_minor,
          currency: current.fk_billing_plan_id.currency,
          interval: current.fk_billing_plan_id.interval,
          interval_count: current.fk_billing_plan_id.interval_count,
          active: current.fk_billing_plan_id.active
        } : null
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Post('/billing/subscribe')
  async subscribe(
    @CurrentUser() user: User | null,
    @Body() body: { planId?: number; slug?: string },
    @Res() res: any
  ) {
    try {
      if (!user?.id) return res.status(401).json({ message: 'Unauthorized' });

      const planRepo = AppDataSource.getRepository(BillingPlan);
      let plan: BillingPlan | null = null;

      if (body?.planId) {
        plan = await planRepo.findOneBy({ id: body.planId });
      } else if (body?.slug) {
        plan = await planRepo.findOneBy({ slug: body.slug });
      }

      if (!plan) return res.status(404).json({ message: 'Plan not found' });
      if (!plan.active) return res.status(400).json({ message: 'Plan is inactive' });

      const userRepo = AppDataSource.getRepository(User);

      if (!plan) return res.status(404).json({ message: 'Plan not found' });
      if (!plan.active) return res.status(400).json({ message: 'Plan is inactive' });
      if (body.slug !== undefined) plan.slug = body.slug as string;
      user.fk_billing_plan_id = plan;
      await userRepo.save(user);

      // Persist selection in UserPackageSelection and assign default icons for the plan
      const upsRepo = AppDataSource.getRepository(require('../entity/UserPackageSelection').UserPackageSelection);
      let selection = await upsRepo.findOne({ where: { fk_user_id: { id: user.id } } });
      if (!selection) {
        // Fetch default icons for the plan
        const planRepo = AppDataSource.getRepository(require('../entity/BillingPlan').BillingPlan);
        const planWithIcons = await planRepo.findOne({ where: { id: plan.id }, relations: ['icons'] });
        const defaultIcons = planWithIcons?.icons || [];
        selection = upsRepo.create({ fk_user_id: user, fk_billing_id: plan, fk_icons_id: defaultIcons });
      } else {
        selection.fk_billing_id = plan;
      }
      await upsRepo.save(selection);

      // Emit socket event for real-time update
      try {
        const io = getIO();
        io.emit('billingPlanChanged', { userId: user.id, planId: plan.id });
      } catch (e) {
        // Socket not available, ignore
      }

      // Fetch updated user with plan
      const updatedUser = await userRepo.findOne({
        where: { id: user.id },
        relations: ['fk_billing_plan_id']
      });
      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name
        },
        message: 'Billing plan updated.',
        plan,
        selectedPlan: updatedUser?.fk_billing_plan_id ? {
          id: updatedUser.fk_billing_plan_id.id,
          name: updatedUser.fk_billing_plan_id.name,
          slug: updatedUser.fk_billing_plan_id.slug,
          description: updatedUser.fk_billing_plan_id.description,
          amount_minor: updatedUser.fk_billing_plan_id.amount_minor,
          currency: updatedUser.fk_billing_plan_id.currency,
          interval: updatedUser.fk_billing_plan_id.interval,
          interval_count: updatedUser.fk_billing_plan_id.interval_count,
          active: updatedUser.fk_billing_plan_id.active
        } : null
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Post('/billing/checkout-session')
  async createCheckoutSession(
    @CurrentUser() user: User | null,
    @Body() body: { planId?: number },
    @Req() req: any,
    @Res() res: any
  ) {
    try {
      // Fallback: If user is null, try to get user from session_token in headers or cookies
      if (!user || !user.id) {
        let sessionToken = req.headers['authorization'] || req.headers['x-session-token'] || '';
        if (typeof sessionToken === 'string' && sessionToken.startsWith('Bearer ')) {
          sessionToken = sessionToken.replace('Bearer ', '').trim();
        }
        if (!sessionToken && req.cookies && req.cookies['session_token']) {
          sessionToken = req.cookies['session_token'];
        }
        if (sessionToken) {
          const sessionRepo = AppDataSource.getRepository(require('../entity/UserSession').UserSession);
          const session = await sessionRepo.findOne({ where: { session_token: sessionToken }, relations: ['fk_logged_in_user'] });
          if (session && session.fk_logged_in_user) {
            user = session.fk_logged_in_user;
          }
        }
      }
      if (!user?.id) return res.status(401).json({ message: 'Unauthorized' });

      const planId = Number(body?.planId || 0);
      if (!planId) return res.status(400).json({ message: 'Missing planId' });

      const planRepo = AppDataSource.getRepository(BillingPlan);
      const plan = await planRepo.findOneBy({ id: planId });
      if (!plan) return res.status(404).json({ message: 'Plan not found' });
      if (!plan.active) return res.status(400).json({ message: 'Plan is inactive' });

      const userRepo = AppDataSource.getRepository(User);
      const dbUser = await userRepo.findOneBy({ id: user.id });
      if (!dbUser) return res.status(404).json({ message: 'User not found' });

      const stripe = this.getStripe();
      let stripeCustomerId = dbUser.stripe_customer_id;
      if (!stripeCustomerId) {
        // Create Stripe customer and save to user
        const customer = await stripe.customers.create({
          email: dbUser.email,
          name: dbUser.first_name + ' ' + dbUser.last_name,
          metadata: { userId: dbUser.id }
        });
        stripeCustomerId = customer.id;
        dbUser.stripe_customer_id = stripeCustomerId;
        await userRepo.save(dbUser);
      } else {
        // Using existing Stripe customer
      }

      const origin = String(req.headers.origin || '').replace(/\/$/, '');
      const successUrl = process.env.STRIPE_SUCCESS_URL || (origin ? `${origin}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}` : '');
      const cancelUrl = process.env.STRIPE_CANCEL_URL || (origin ? `${origin}/dashboard/billing?canceled=1` : '');

      if (!successUrl || !cancelUrl) {
        return res.status(400).json({ message: 'Stripe success/cancel URLs are not configured' });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: (plan.currency || 'EUR').toLowerCase(),
              unit_amount: Number(plan.amount_minor || 0),
              product_data: {
                name: plan.name,
                description: plan.description || undefined
              }
            }
          }
        ],
        metadata: {
          planId: String(plan.id),
          userId: String(user.id)
        },
        customer: stripeCustomerId
      });

      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name
        },
        id: session.id,
        url: session.url
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Get('/billing/checkout/confirm')
  async confirmCheckout(
    @CurrentUser() user: User | null,
    @QueryParam('session_id') sessionId: string,
    @Res() res: any
  ) {
    try {
      if (!user?.id) return res.status(401).json({ message: 'Unauthorized' });
      if (!sessionId) return res.status(400).json({ message: 'Missing session_id' });

      const stripe = this.getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session || session.payment_status !== 'paid') {
        return res.status(400).json({ message: 'Payment not completed' });
      }

      const metaUserId = Number((session.metadata || {}).userId || 0);
      const metaPlanId = Number((session.metadata || {}).planId || 0);
      if (!metaPlanId || !metaUserId || metaUserId !== user.id) {
        return res.status(400).json({ message: 'Invalid session metadata' });
      }

      const planRepo = AppDataSource.getRepository(BillingPlan);
      const plan = await planRepo.findOneBy({ id: metaPlanId });
      if (!plan) return res.status(404).json({ message: 'Plan not found' });
      if (!plan.active) return res.status(400).json({ message: 'Plan is inactive' });

      const userRepo = AppDataSource.getRepository(User);
      const dbUser = await userRepo.findOneBy({ id: user.id });
      if (!dbUser) return res.status(404).json({ message: 'User not found' });

      // Save Stripe customer ID if available
      let updated = false;
      if (session.customer && typeof session.customer === 'string') {
        if (!dbUser.stripe_customer_id || dbUser.stripe_customer_id !== session.customer) {
          dbUser.stripe_customer_id = session.customer;
          updated = true;
        }
      } else {
        // No Stripe customer found in session
      }
      if (!dbUser.fk_billing_plan_id || dbUser.fk_billing_plan_id.id !== plan.id) {
        dbUser.fk_billing_plan_id = plan;
        updated = true;
      }
      if (updated) {
        await userRepo.save(dbUser);
      } else {
        // No updates needed for user
      }
      // Fetch updated user to confirm
      const updatedUser = await userRepo.findOne({ where: { id: dbUser.id }, relations: ['fk_billing_plan_id'] });
      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name
        },
        message: 'Payment confirmed.',
        plan: updatedUser?.fk_billing_plan_id,
        stripeCustomerId: updatedUser?.stripe_customer_id
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Post('/billing/plans/seed')
  async seedPlans(@Res() res: any) {
    try {
      const planRepo = AppDataSource.getRepository(BillingPlan);
      const defaults: Array<Partial<BillingPlan>> = [
        {
          slug: 'free',
          name: 'Free',
          description: 'Osnovni paket za preizkus aplikacije: omejene funkcije, brez premium ugodnosti.',
          active: true,
          pricing_model: 'flat' as any,
          amount_minor: 0,
          currency: 'EUR',
          interval: 'month' as any,
          interval_count: 1,
          trial_days: 0
        },
        {
          slug: 'pro',
          name: 'Pro',
          description: 'Pro paket vključuje: dodajanje novic, video posnetkov, kategorij, ustvarjanje albumov, napredno iskanje, prioritetno podporo, večja vidnost profila, dostop do premium funkcij. Vse funkcije so na voljo brez omejitev.',
          active: true,
          pricing_model: 'flat' as any,
          amount_minor: 990,
          currency: 'EUR',
          interval: 'month' as any,
          interval_count: 1,
          trial_days: 7
        },
        {
          slug: 'pro_plus',
          name: 'Pro Plus',
          description: 'Najboljši paket z vsemi funkcijami, premium ugodnostmi in najvišjo prioriteto podpore.',
          active: true,
          pricing_model: 'flat' as any,
          amount_minor: 1990,
          currency: 'EUR',
          interval: 'month' as any,
          interval_count: 1,
          trial_days: 14
        },
        {
          slug: 'lifetime',
          name: 'Lifetime',
          description: 'Enkratni nakup za doživljenjski dostop do vseh funkcij.',
          active: true,
          pricing_model: 'flat' as any,
          amount_minor: 10000,
          currency: 'EUR',
          interval: 'year' as any,
          interval_count: 1,
          trial_days: 0
        }
      ];

      const created: BillingPlan[] = [];
      for (const item of defaults) {
        const exists = await planRepo.findOneBy({ slug: item.slug as string });
        if (exists) continue;
        const plan = planRepo.create(item);
        created.push(await planRepo.save(plan));
      }

      return res.status(200).json({ message: 'Seed completed', created });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Post('/billing/plans')
  async createPlan(
    @CurrentUser() user: User | null,
    @Body() body: Partial<BillingPlan>,
    @Res() res: any
  ) {
    try {
      if (!user?.id) return res.status(401).json({ message: 'Unauthorized' });

      if (!body?.slug || !body?.name) {
        return res.status(400).json({ message: 'Missing required fields.' });
      }

      const planRepo = AppDataSource.getRepository(BillingPlan);
      const exists = await planRepo.findOneBy({ slug: body.slug });
      if (exists) return res.status(400).json({ message: 'Plan slug already exists.' });

      const plan = planRepo.create({
        slug: body.slug,
        name: body.name,
        description: body.description || '',
        active: body.active ?? true,
        pricing_model: (body.pricing_model as any) || 'flat',
        amount_minor: Number(body.amount_minor ?? 0),
        currency: (body.currency || 'EUR').toUpperCase(),
        interval: (body.interval as any) || 'month',
        interval_count: Number(body.interval_count ?? 1),
        trial_days: Number(body.trial_days ?? 0),
        max_seats: body.max_seats ?? null,
        metadata: body.metadata || null
      });

      const saved = await planRepo.save(plan);
      return res.status(201).json(saved);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Patch('/billing/plans/:id/active')
  async setPlanActive(
    @CurrentUser() user: User | null,
    @Param('id') id: number,
    @Body() body: { active?: boolean },
    @Res() res: any
  ) {
    try {
      if (!user?.id) return res.status(401).json({ message: 'Unauthorized' });

      const planRepo = AppDataSource.getRepository(BillingPlan);
      const plan = await planRepo.findOneBy({ id: Number(id) });
      if (!plan) return res.status(404).json({ message: 'Plan not found' });

      plan.active = !!body?.active;
      const saved = await planRepo.save(plan);
      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name
        },
        plan: saved
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Delete('/billing/plans/:id')
  async deletePlan(
    @CurrentUser() user: User | null,
    @Param('id') id: number,
    @Res() res: any
  ) {
    try {
      if (!user?.id) return res.status(401).json({ message: 'Unauthorized' });

      const planRepo = AppDataSource.getRepository(BillingPlan);
      const plan = await planRepo.findOneBy({ id: Number(id) });
      if (!plan) return res.status(404).json({ message: 'Plan not found' });

      await AppDataSource.getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({ fk_billing_plan_id: null as any })
        .where('fk_billing_plan_id = :id', { id: plan.id })
        .execute();

      await planRepo.remove(plan);
      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name
        },
        message: 'Plan deleted.'
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  /* Create here a function to create a customer   */

  /**
   * Create a Stripe customer
   * POST /stripe/create-customer
   * Body: { name, email, language, billingEmail, billingCountry, billingPrefix, billingPhone, taxStatus, taxIdType, taxId, shippingName, shippingCountry, shippingPrefix, shippingPhone }
   */
  @Post('/stripe/create-customer')
  async createStripeCustomer(
    @Body() body: any,
    @Res() res: any
  ) {
    try {
      const stripe = this.getStripe();
      // Map form fields to Stripe customer fields
      const customerData: any = {
        name: body.name,
        email: body.email,
        phone: body.billingPhone,
        metadata: {
          language: body.language,
          billingEmail: body.billingEmail,
          billingCountry: body.billingCountry,
          billingPrefix: body.billingPrefix,
          taxStatus: body.taxStatus,
          taxIdType: body.taxIdType,
          taxId: body.taxId,
          shippingName: body.shippingName,
          shippingCountry: body.shippingCountry,
          shippingPrefix: body.shippingPrefix,
          shippingPhone: body.shippingPhone
        }
      };
      // Optionally add shipping if provided
      if (body.shippingName || body.shippingCountry || body.shippingPhone) {
        customerData.shipping = {
          name: body.shippingName,
          phone: body.shippingPhone,
          address: {
            country: body.shippingCountry || undefined
          }
        };
      }
      // Optionally add tax info if provided
      if (body.taxId && body.taxIdType && body.taxStatus) {
        // Map Slovenian taxIdType to 'si_tin' for Stripe
        let taxIdType = body.taxIdType;
        if (
          (taxIdType && typeof taxIdType === 'string' &&
            [
              'sl_tin', 'slovenia_tin', 'slovenian_tin', 'si', 'SI', 'SI_TIN', 'SI_TIN', 'slovenia', 'slovenija'
            ].includes(taxIdType.toLowerCase())) ||
          (body.billingCountry && body.billingCountry.toLowerCase() === 'si')
        ) {
          taxIdType = 'si_tin';
        }
        customerData.tax = {
          ip_address: undefined // Stripe may require more info for tax, see docs
        };
        customerData.tax_id_data = [{
          type: taxIdType,
          value: body.taxId
        }];
      }
      const customer = await stripe.customers.create(customerData);
      return res.status(201).json(customer);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  /**
   * Get all Stripe customers
   * GET /stripe/customers
   */
  @Get('/stripe/customers')
  async getAllStripeCustomers(@Res() res: any) {
    try {
      const stripe = this.getStripe();
      const customers = await stripe.customers.list({ limit: 100 });
      // Map to a structure with all possible fields for frontend
      const mapped = customers.data.map((customer: any) => ({
        id: customer.id,
        name: customer.name || '',
        email: customer.email || '',
        language: customer.metadata?.language || '',
        billingEmail: customer.metadata?.billingEmail || '',
        sameAsAccountEmail: customer.metadata?.sameAsAccountEmail === 'true',
        billingCountry: customer.metadata?.billingCountry || '',
        billingPrefix: customer.metadata?.billingPrefix || '',
        billingPhone: customer.metadata?.billingPhone || '',
        taxStatus: customer.metadata?.taxStatus || '',
        taxIdType: customer.metadata?.taxIdType || '',
        taxId: customer.metadata?.taxId || '',
        shippingName: customer.metadata?.shippingName || '',
        shippingCountry: customer.metadata?.shippingCountry || '',
        shippingPrefix: customer.metadata?.shippingPrefix || '',
        shippingPhone: customer.metadata?.shippingPhone || '',
        // legacy fields for compatibility
        username: customer.name || customer.email,
        first_name: customer.name ? customer.name.split(' ')[0] : '',
        last_name: customer.name ? customer.name.split(' ').slice(1).join(' ') : '',
        stripeCustomerId: customer.id
      }));
      return res.status(200).json(mapped);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }


    /**
   * Update a Stripe customer (name, email)
   * PATCH /stripe/customer/:customerId
   * Body: { first_name, last_name, email }
   */
  @Patch('/stripe/customer/:customerId')
  async updateStripeCustomer(
    @Param('customerId') customerId: string,
    @Body() body: { first_name?: string; last_name?: string; email?: string },
    @Res() res: any
  ) {
    try {
      const stripe = this.getStripe();
      const update: any = {};
      if (body.first_name || body.last_name) {
        update.name = `${body.first_name || ''} ${body.last_name || ''}`.trim();
      }
      if (body.email) {
        update.email = body.email;
      }
      const customer = await stripe.customers.update(customerId, update);
      return res.status(200).json({ message: 'Stripe stranka posodobljena.', customer });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }


    /**
   * Delete a Stripe customer
   * DELETE /stripe/customer/:customerId
   */
  @Delete('/stripe/customer/:customerId')
  async deleteStripeCustomer(
    @Param('customerId') customerId: string,
    @Res() res: any
  ) {
    try {
      const stripe = this.getStripe();
      await stripe.customers.del(customerId);
      return res.status(200).json({ message: 'Stripe stranka izbrisana.' });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }


    /**
   * Create a Stripe product and also insert into billing_plan table
   * POST /stripe/create-product
   * Body: { name, description, amount, currency, pricingType, billingPeriod, imageUrl, taxPreset }
   */
  @Post('/stripe/create-product')
  async createStripeProductAndPlan(
    @Body() body: any,
    @CurrentUser() user: User | null,
    @Res() res: any
  ) {
    try {
      const stripe = this.getStripe();
      // Create product in Stripe
      const product = await stripe.products.create({
        name: body.name,
        description: body.description,
        images: body.imageUrl ? [body.imageUrl] : [],
        metadata: {
          taxPreset: body.taxPreset || '',
          createdBy: user?.id || ''
        }
      });
      // Create price in Stripe
      const price = await stripe.prices.create({
        unit_amount: Math.round(body.amount * 100),
        currency: body.currency || 'EUR',
        recurring: body.pricingType === 'recurring' ? { interval: body.billingPeriod.toLowerCase() } : undefined,
        product: product.id
      });
      // Insert into billing_plan table
      const planRepo = AppDataSource.getRepository(BillingPlan);
      const plan = planRepo.create({
        name: body.name,
        description: body.description,
        amount_minor: Math.round(body.amount * 100),
        currency: body.currency || 'EUR',
        pricing_model: 'pro', // or 'free' or 'pro_plus' as needed
        interval: body.billingPeriod.toLowerCase(),
        interval_count: 1,
        active: true,
        slug: body.name.toLowerCase().replace(/\s+/g, '-'),
        stripe_price_id: price.id,
        metadata: {
          stripeProductId: product.id,
          taxPreset: body.taxPreset || ''
        }
      });
      if (user) plan.fk_user_id = user;
      await planRepo.save(plan);
      return res.status(201).json({ stripeProduct: product, stripePrice: price, billingPlan: plan });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

}