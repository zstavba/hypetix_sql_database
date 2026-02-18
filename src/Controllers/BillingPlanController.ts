// Simple in-memory undo stack for demonstration (not for production)
const planUndoStack: any[] = [];

import { AppDataSource } from './../data-source';
import { Request, Response } from 'express';
import { Body, CurrentUser, Delete, Get, JsonController, Param, Patch, Post, Put, QueryParam, Req, Res } from 'routing-controllers';
import { BillingPlan } from '../entity/BillingPlan';
import { BillingPlanIcons } from '../entity/BillingPlanIcons';
import { User } from '../entity/User';
import { UserPackageSelection } from '../entity/UserPackageSelection';

@JsonController('/billing/plans')
export class BillingPlanController {
  /**
   * Get icons for a billing plan filtered by icon key
   * GET /billing/plans/:planId/icons/key/:key
   */
  @Get('/:planId/icons/key/:key')
  async getPlanIconsByKey(@Param('planId') planId: number, @Param('key') key: string, @Res() res: Response) {
    try {
      const iconRepo = AppDataSource.getRepository(BillingPlanIcons);
      const icons = await iconRepo.find({ where: { billingPlanId: planId, key } });
      return res.status(200).json(icons);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }
  // Support POST /billing/icons for legacy or frontend compatibility
  @Post('/icons')
  async addIconViaFlatEndpoint(@Body() iconData: { label: string, key: string, iconUrl?: string, planId?: number }, @Res() res: Response) {
    if (!iconData.planId) {
      return res.status(400).json({ message: 'Missing planId in request body.' });
    }
    // Forward to the main addIconToPlan logic
    return this.addIconToPlan(iconData.planId, iconData, res);
  }

    /**
     * Create and assign an icon to a billing plan
     * POST /billing/plans/:planId/icons
     */
    @Post('/billing/plans/:planId/icons')
    async createBillingPlanIcon(@Param('planId') planId: number, @Body() body: any, @Req() req: Request, @Res() res: Response) {
      try {
        const { key, label, iconUrl } = body;
        console.log('[createBillingPlanIcon] Received planId:', planId, 'body:', body);
        if (!key || !label) {
          return res.status(400).json({ message: 'Key and label are required.' });
        }
        const planRepo = AppDataSource.getRepository(BillingPlan);
        const iconRepo = AppDataSource.getRepository(BillingPlanIcons);
        const plan = await planRepo.findOne({ where: { id: planId } });
        if (!plan) {
          console.warn('[createBillingPlanIcon] Billing plan not found for id:', planId);
          return res.status(404).json({ message: 'Billing plan not found.' });
        }
        const newIcon = iconRepo.create({
          key,
          label,
          iconUrl,
          billingPlan: plan,
          billingPlanId: plan.id
        });
        console.log('[createBillingPlanIcon] Saving icon with billingPlan:', plan.id);
        await iconRepo.save(newIcon);
        // Fetch the icon with relations to verify
        const savedIcon = await iconRepo.findOne({ where: { id: newIcon.id }, relations: ['billingPlan'] });
        console.log('[createBillingPlanIcon] Saved icon:', savedIcon);
        // Ensure billingPlanId is included in the response for frontend
        const iconResponse = {
          ...savedIcon,
          billingPlanId: savedIcon?.billingPlan?.id || planId
        };
        return res.status(201).json(iconResponse);
      } catch (error: any) {
        console.error('Error creating billing plan icon:', error);
        return res.status(500).json({ message: 'Internal server error.' });
      }
    }
  /**
   * Get icons for a billing plan and user
   * GET /billing/plans/:planId/icons/user/:userId
   */
  @Get('/:planId/icons/user/:userId')
  async getPlanIconsForUser(@Param('planId') planId: number, @Param('userId') userId: number, @Res() res: Response) {
    try {
      const planRepo = AppDataSource.getRepository(BillingPlan);
      const iconRepo = AppDataSource.getRepository(BillingPlanIcons);
      const userRepo = AppDataSource.getRepository(User);
      const plan = await planRepo.findOne({ where: { id: planId }, relations: ['icons'] });
      if (!plan) return res.status(404).json({ message: 'Plan not found' });
      const user = await userRepo.findOne({ where: { id: userId }, relations: ['iconAssignments'] });
      if (!user) return res.status(404).json({ message: 'User not found' });
      // Icons assigned to plan
      const planIcons = plan.icons || [];
      // Icons assigned to user (if any)
      const userIcons = user.iconAssignments || [];
      // Merge and deduplicate by icon id
      const allIconsMap = new Map();
      for (const icon of [...planIcons, ...userIcons]) {
        if (icon && icon.id) {
          allIconsMap.set(icon.id, icon);
        }
      }
      return res.status(200).json(Array.from(allIconsMap.values()));
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Get('/')
  async listPlans(@Res() res: Response) {
    try {
      const planRepo = AppDataSource.getRepository(BillingPlan);
      const plans = await planRepo.find({ relations: ['icons'] });
      return res.status(200).json(plans);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Get('/:planId/icons')
  async getPlanIcons(@Param('planId') planId: number, @Res() res: Response) {
    try {
      const planRepo = AppDataSource.getRepository(BillingPlan);
      const plan = await planRepo.findOne({
        where: { id: planId },
        relations: ['icons']
      });
      if (!plan) return res.status(404).json({ message: 'Plan not found' });
      // Map icons to always include iconUrl and billingPlanId
      const icons = (plan.icons || []).map(icon => ({
        ...icon,
        iconUrl: icon.iconUrl || '',
        billingPlanId: icon.billingPlanId || icon.billingPlan?.id || planId
      }));
      return res.status(200).json(icons);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

    @Get('/:planId')
    async getPlan(@Param('planId') planId: number, @Res() res: Response) {
      try {
        const planRepo = AppDataSource.getRepository(BillingPlan);
        const plan = await planRepo.findOneBy({ id: planId });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        return res.status(200).json(plan);
      } catch (error: any) {
        return res.status(500).json({ message: error.message });
      }
    }

    @Post('/')
    async createPlan(@Body() body: Partial<BillingPlan>, @Res() res: Response) {
      try {
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
          stripe_price_id: (body as any).stripePriceId ?? null,
          metadata: body.metadata || null
        });
        const saved = await planRepo.save(plan);
        return res.status(201).json(saved);
      } catch (error: any) {
        return res.status(500).json({ message: error.message });
      }
    }

    @Put('/:id')
    async updatePlan(@Param('id') id: number, @Body() body: Partial<BillingPlan>, @Res() res: Response) {
      try {
        const planRepo = AppDataSource.getRepository(BillingPlan);
        const plan = await planRepo.findOneBy({ id: Number(id) });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        // Save current state for undo
        planUndoStack.push({ ...plan });
        if (body.slug && body.slug !== plan.slug) {
          const exists = await planRepo.findOneBy({ slug: body.slug });
          if (exists) return res.status(400).json({ message: 'Plan slug already exists.' });
          plan.slug = body.slug;
        }
        if (body.name !== undefined) plan.name = body.name as string;
        if (body.description !== undefined) plan.description = body.description as string;
        if (body.active !== undefined) plan.active = !!body.active;
        if (body.pricing_model !== undefined) plan.pricing_model = body.pricing_model as any;
        if (body.amount_minor !== undefined) plan.amount_minor = Number(body.amount_minor);
        if (body.currency !== undefined) plan.currency = (body.currency || 'EUR').toUpperCase();
        if (body.interval !== undefined) plan.interval = body.interval as any;
        if (body.interval_count !== undefined) plan.interval_count = Number(body.interval_count);
        if (body.trial_days !== undefined) plan.trial_days = Number(body.trial_days);
        if (body.max_seats !== undefined) plan.max_seats = body.max_seats as any;
        if ((body as any).stripePriceId !== undefined) plan.stripe_price_id = (body as any).stripePriceId;
        if (body.metadata !== undefined) plan.metadata = body.metadata as any;
        const saved = await planRepo.save(plan);
        return res.status(200).json(saved);
      } catch (error: any) {
        return res.status(500).json({ message: error.message });
      }
    }

    @Patch('/:id/active')
    async setPlanActive(@Param('id') id: number, @Body() body: { active?: boolean }, @Res() res: Response) {
      try {
        const planRepo = AppDataSource.getRepository(BillingPlan);
        const plan = await planRepo.findOneBy({ id: Number(id) });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        plan.active = !!body?.active;
        const saved = await planRepo.save(plan);
        return res.status(200).json(saved);
      } catch (error: any) {
        return res.status(500).json({ message: error.message });
      }
    }

    @Delete('/:id')
    async deletePlan(@Param('id') id: number, @Res() res: Response) {
      try {
        const planRepo = AppDataSource.getRepository(BillingPlan);
        const plan = await planRepo.findOneBy({ id: Number(id) });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        // Save current state for undo
        planUndoStack.push({ ...plan });
        await AppDataSource.getRepository(User)
          .createQueryBuilder()
          .update(User)
          .set({ fk_billing_plan_id: null as any })
          .where('fk_billing_plan_id = :id', { id: plan.id })
          .execute();
        await planRepo.remove(plan);
        return res.status(200).json({ message: 'Plan deleted.' });
      } catch (error: any) {
        return res.status(500).json({ message: error.message });
      }
    }
    // Undo last update or delete (restores last plan state)
    @Post('/seed')
    async seedPlans(@Res() res: Response) {
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

    @Get('/:planId/users')
    async getUsersByPlan(@Param('planId') planId: number, @Req() req: Request, @Res() res: Response) {
      try {
        // Users with fk_billing_plan_id = planId
        const userRepo = AppDataSource.getRepository(User);
        const directUsers = await userRepo
          .createQueryBuilder('U')
          .leftJoinAndSelect('U.profileImage', 'profileImage')
          .where('U.fk_billing_plan_id = :planId', { planId })
          .select([
            'U.id', 'U.username', 'U.email', 'U.first_name', 'U.last_name', 'U.stripe_customer_id',
            'profileImage.id', 'profileImage.path'
          ])
          .getMany();
        // Users with a UserPackageSelection for this plan
        const upsRepo = AppDataSource.getRepository(UserPackageSelection);
        const selections = await upsRepo.find({ where: { fk_billing_id: { id: planId } }, relations: ['fk_user_id', 'fk_user_id.profileImage'] });
        const selectionUsers = selections.map(sel => sel.fk_user_id).filter(Boolean);
        // Helper to get absolute URL
        const getAbsoluteUrl = (req: any, path: string) => {
          if (!path) return null;
          if (path.startsWith('http')) return path;
          if (req && req.protocol && req.get) {
            return `${req.protocol}://${req.get('host')}/uploads/${path.replace(/^uploads[\\\/]/, '')}`;
          }
          return `/uploads/${path}`;
        };
        // Merge and deduplicate users by id
        const allUsersMap = new Map();
        for (const u of [...directUsers, ...selectionUsers]) {
          if (u && u.id) {
            let profile_image_url = null;
            // Defensive: handle both direct and nested profileImage/profile_image
            let img = null;
            if (u.profileImage && typeof u.profileImage === 'object' && u.profileImage !== null) {
              img = u.profileImage;
            } else if (u.profileImage && typeof u.profileImage === 'object' && u.profileImage !== null) {
              img = u.profileImage;
            }
            if (img && typeof img.path === 'string' && img.path) {
              profile_image_url = getAbsoluteUrl(req, img.path);
            } else {
              profile_image_url = null;
            }
            allUsersMap.set(u.id, {
              id: u.id,
              username: u.username,
              email: u.email,
              first_name: u.first_name,
              last_name: u.last_name,
              stripeCustomerId: u.stripe_customer_id || u.stripe_customer_id || null,
              profile_image_url
            });
          }
        }
        return res.status(200).json(Array.from(allUsersMap.values()));
      } catch (error: any) {
        return res.status(500).json({ message: error.message });
      }
    }
  @Post('/:planId/icons')
  async addIconToPlan(@Param('planId') planId: number, @Body() iconData: { label: string, key: string, iconUrl?: string }, @Res() res: Response) {
    try {
      const planRepo = AppDataSource.getRepository(BillingPlan);
      const iconRepo = AppDataSource.getRepository(BillingPlanIcons);
      const plan = await planRepo.findOne({ where: { id: planId }, relations: ['icons'] });
      if (!plan) return res.status(404).json({ message: 'Plan not found' });
      const existing = await iconRepo.findOne({ where: { key: iconData.key, billingPlan: { id: planId } } });
      if (existing) return res.status(409).json({ message: 'Icon with this key already exists for this plan' });
      const newIcon = iconRepo.create({ ...iconData, billingPlan: plan, billingPlanId: plan.id });
      const savedIcon = await iconRepo.save(newIcon);
      plan.icons = plan.icons ? [...plan.icons, savedIcon] : [savedIcon];
      await planRepo.save(plan);
      return res.status(201).json(savedIcon);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  @Delete('/:planId/icons/:iconId')
  async removeIconFromPlan(@Param('planId') planId: number, @Param('iconId') iconId: number, @Res() res: Response) {
    try {
      const iconRepo = AppDataSource.getRepository(BillingPlanIcons);
      const icon = await iconRepo.findOne({ where: { id: iconId, billingPlan: { id: planId } } });
      if (!icon) return res.status(404).json({ message: 'Icon not found for this plan' });
      await iconRepo.remove(icon);
      return res.status(200).json({ message: 'Icon removed from plan' });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  /**
   * Get the latest UserPackageSelection for a user
   * GET /billing/user-package-selection/user/:userId
   */
  @Get('/user-package-selection/user/:userId')
  async getUserPackageSelectionByUser(@Param('userId') userId: number, @Res() res: Response) {
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
}
