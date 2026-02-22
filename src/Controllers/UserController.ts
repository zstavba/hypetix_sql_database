import { BillingPlan } from '../entity/BillingPlan';
import { BillingPlanIcons } from '../entity/BillingPlanIcons';

import { AppDataSource } from './../data-source';
import { NextFunction } from 'express';
import { JsonController, Post, Body, Req, Res, Get, Delete, UseBefore, UploadedFile, Param, createExpressServer, UploadedFiles, Put } from 'routing-controllers';
import { User } from '../entity/User';
const { sendWelcomeEmail } = require("../utils/mailer");
import * as bcyrpt from 'bcryptjs';
import { UserSession } from '../entity/UserSession';
import * as crypto from "crypto";
import multer, { Options } from 'multer';
import path = require('path');
import * as fs from 'fs';
import { UserImages } from '../entity/UserImages';
import type * as Express from 'express';
import { UserFavorites } from '../entity/UserFavorites';
import { UserInformation } from '../entity/UserInformation';
import { Notification } from '../entity/Notification';

const allowed = [
  'image/jpeg','image/png','image/webp','image/gif',
  'image/avif','image/svg+xml','image/heic','image/heif'
];

const fileUploadOptions = (): Options => ({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'uploads'),
    filename: (_req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
  }),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(null, false); // Use null for error, false for rejection
  },
});

const upload = multer(fileUploadOptions());

export enum FavoriteStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  CANCELED = "canceled",
}


@JsonController()
export default class UserController {

    /**
     * Get all friends for a user by fk_user_id from UserFavorites table
     * GET /user/:fk_user_id/friends
     */
    @Get('/user/:fk_user_id/friends')
    async getUserFriends(@Param('fk_user_id') fk_user_id: number, @Res() res: any) {
        try {
            const favorites = await AppDataSource.getRepository(UserFavorites)
                .createQueryBuilder('f')
                .where('(f.fk_user_one_id = :id OR f.fk_user_two_id = :id)', { id: fk_user_id })
                .andWhere('f.status = :status', { status: 'accepted' })
                .skip(0)
                .take(10)
                .getMany();
            // Only return minimal friend info
            const friends = favorites.map(fav => {
                const friend = fav.fk_user_one_id.id === Number(fk_user_id) ? fav.fk_user_two_id : fav.fk_user_one_id;
                return {
                    id: friend.id,
                    username: friend.username,
                    email: friend.email
                };
            });
            return res.status(200).json(friends);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }





    /**
     * Get user by session token (for SPA session refresh)
     * GET /user-session/by-token?session_token=...
     */
    @Get('/user-session/by-token')
    async getUserBySessionToken(@Req() req: any, @Res() res: any) {
        try {
            const token = String(req.query.session_token || '').trim();
            if (!token) {
                return res.status(400).json({ message: 'Missing session token.' });
            }
            // Join user and billing plan
            const session = await AppDataSource.getRepository(require('../entity/UserSession').UserSession)
                .createQueryBuilder('s')
                .leftJoinAndSelect('s.fk_logged_in_user', 'user')
                .leftJoinAndSelect('user.fk_billing_plan_id', 'BillingPlan')
                .leftJoinAndSelect('user.profileImage', 'ProfileImage')
                .leftJoinAndSelect('user.cover_photo', 'CoverPhoto')
                .where('s.session_token = :token', { token })
                .getOne();
            if (!session?.fk_logged_in_user) {
                return res.status(401).json({ message: 'Invalid session.' });
            }
            return res.status(200).json({ user: session.fk_logged_in_user });
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }
    @Get('/user/get/list')
    async getUsers(@Req() req: any, @Res() res: any) {
        try {
            // Pagination params
            const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
            const limit = 20;
            const skip = (page - 1) * limit;

            let [list, total] = await AppDataSource.manager.getRepository(User)
                .createQueryBuilder("U")
                .leftJoinAndSelect("U.profileImage", "ProfileImage")
                .select(["U.id", "U.username", "U.email", "U.first_name", "U.last_name", "ProfileImage.id", "ProfileImage.path"])
                .skip(skip)
                .take(limit)
                .getManyAndCount();
            if (list.length <= 0)
                throw new Error(`Napaka: Seznam uporabnikov je trenutno prazen !!!`);

            // Remove duplicates based on id, username, or email
            const seen = new Set();
            const uniqueList = list.filter(u => {
                const key = u.id || u.username || u.email;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            return res.status(200).json({
                users: uniqueList,
                page,
                pageSize: limit,
                total
            });
        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Get('/user/get/:username')
    async getUserInformation(@Param('username' ) username: string ,@Req() req: any, @Res() res: any) {
        try {
            let findUser = await AppDataSource.manager.getRepository(User)
                .createQueryBuilder("U")
                .leftJoinAndSelect("U.profileImage","ProfileImage")
                .leftJoinAndSelect("U.cover_photo","coverPhoto")
                .where({ username: username })
                .getOne();
            return res.status(200).json(findUser);
        } catch (error: Error | any) {
            return res.status(401).json({ message: error.message });
        }

    }


    @Get('/user/get/id/:id')
    async getUserById(@Param('id') id: number, @Req() req: any, @Res() res: any) {
        try {
            let findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .leftJoinAndSelect("U.profileImage","ProfileImage")
                                                      .leftJoinAndSelect("U.cover_photo","coverPhoto")
                                                      .where({ id: id })
                                                      .getOne();

            if (!findUser) {
                throw new Error(`Napaka: Uporabnik z ID ${id} ni bil najden.`);
            }

            return res.status(200).json(findUser);

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }


    @Get('/user/get/information/:username')
    async get_user_information_by_id (@Param('username') username: string, @Req() req: any, @Res() res: any) {
        try {

            let findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .where({
                                                        username: username
                                                      })
                                                      .getOne();


            if(!findUser)
                throw new Error(`Napaka: Za iskanega uporabnika ni bilo mogoče najti podatkov !!!`);


            let findInformation = await AppDataSource.manager.getRepository(UserInformation)
                                                             .createQueryBuilder("UI")
                                                             .leftJoinAndSelect("UI.fk_user_id","User")
                                                             .where({
                                                                fk_user_id: findUser
                                                             })
                                                             .getOne();


             if(!findInformation)
                throw new Error(`Napaka: Za iskanega uproabnika ni bilo mogoče najti podatkov !!!`);


            return res.status(200).json(findInformation)

        } catch (error: Error | any ) {
            return res.status(401).json({
                message: error.message
            });
        }
    }


    @Get('/user/get/location/:username')
    async get_user_location_by_username(@Param('username') username: string, @Req() req: any, @Res() res: any) {
        try {
            const findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .where({
                                                        username: username
                                                      })
                                                      .getOne();

            if (!findUser) {
                throw new Error(`Napaka: Uporabnik '${username}' ne obstaja!`);
            }

            const latestSession = await AppDataSource.manager.getRepository(UserSession)
                                                             .createQueryBuilder("US")
                                                             .leftJoinAndSelect("US.fk_logged_in_user", "User")
                                                             .where({
                                                                fk_logged_in_user: findUser
                                                             })
                                                             .orderBy("US.updated_at", "DESC")
                                                             .getOne();

            if (!latestSession) {
                return res.status(200).json({
                    username: findUser.username,
                    ip_adress: null,
                    updated_at: null
                });
            }

            return res.status(200).json({
                username: findUser.username,
                ip_adress: latestSession.ip_adress,
                updated_at: latestSession.updated_at
            });

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Get('/user/facebook/auth')
    async facebookAuth(@Req() req: any, @Res() res: any) {
        try {
            const token = String(req.query.token || '').trim();
            const returnUrl = String(req.query.returnUrl || '').trim();

            if (!token) {
                return res.status(400).json({ message: 'Missing session token.' });
            }

            const appId = process.env.FACEBOOK_APP_ID;
            const redirectUri = process.env.FACEBOOK_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/user/facebook/callback`;

            if (!appId || !process.env.FACEBOOK_APP_SECRET) {
                return res.status(500).json({ message: 'Facebook app is not configured.' });
            }

            const state = Buffer.from(JSON.stringify({ token, returnUrl })).toString('base64url');
            const scope = 'public_profile,email';
            const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}`;

            return res.redirect(authUrl);
        } catch (error: Error | any) {
            return res.status(401).json({ message: error.message });
        }
    }

    @Get('/user/facebook/callback')
    async facebookCallback(@Req() req: any, @Res() res: any) {
        try {
            const code = String(req.query.code || '').trim();
            const rawState = String(req.query.state || '').trim();

            if (!code || !rawState) {
                return res.status(400).json({ message: 'Missing OAuth code or state.' });
            }

            const state = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf-8')) as { token: string; returnUrl?: string };
            const token = String(state?.token || '').trim();
            const returnUrl = String(state?.returnUrl || '').trim();

            if (!token) {
                return res.status(400).json({ message: 'Invalid session token.' });
            }

            const appId = process.env.FACEBOOK_APP_ID;
            const appSecret = process.env.FACEBOOK_APP_SECRET;
            const redirectUri = process.env.FACEBOOK_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/user/facebook/callback`;

            if (!appId || !appSecret) {
                return res.status(500).json({ message: 'Facebook app is not configured.' });
            }

            const session = await AppDataSource.getRepository(UserSession)
                .createQueryBuilder('s')
                .leftJoinAndSelect('s.fk_logged_in_user', 'user')
                .where('s.session_token = :token', { token })
                .getOne();

            if (!session?.fk_logged_in_user) {
                return res.status(401).json({ message: 'Invalid session.' });
            }

            const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
            const tokenResponse = await fetch(tokenUrl);
            const tokenData = await tokenResponse.json();

            if (!tokenData?.access_token) {
                return res.status(401).json({ message: 'Failed to exchange code for access token.' });
            }

            const fields = 'id,first_name,last_name,name,email,picture.type(large)';
            const profileUrl = `https://graph.facebook.com/me?fields=${encodeURIComponent(fields)}&access_token=${tokenData.access_token}`;
            const profileResponse = await fetch(profileUrl);
            const profile = await profileResponse.json();

            const userRepo = AppDataSource.getRepository(User);
            const imageRepo = AppDataSource.getRepository(UserImages);
            const user = session.fk_logged_in_user;

            if (profile?.first_name) user.first_name = profile.first_name;
            if (profile?.last_name) user.last_name = profile.last_name;
            if (profile?.email) user.email = profile.email;

            const pictureUrl = profile?.picture?.data?.url;
            if (pictureUrl) {
                const image = new UserImages();
                image.fk_user_id = user;
                image.path = pictureUrl;
                image.album_private = true;
                image.album_name = 'facebook';
                await imageRepo.save(image);
                user.profileImage = image;
                user.profileImageId = String(image.id);
            }

            await userRepo.save(user);

            if (returnUrl) {
                return res.redirect(returnUrl);
            }

            return res.status(200).json({ message: 'Facebook sync completed.' });
        } catch (error: Error | any) {
            return res.status(401).json({ message: error.message });
        }
    }


    @Get('/user/get/geolocation/:ip')
    async get_geolocation_by_ip(@Param('ip') ip: string, @Req() req: any, @Res() res: any) {
        try {
            if (!ip) {
                return res.status(400).json({
                    error: 'IP address required'
                });
            }

            // Normalize the IP
            let normalizedIp = ip.trim();
            
            // Handle localhost/loopback - map to Maribor
            if (normalizedIp === '::1' || normalizedIp === '127.0.0.1') {
                return res.status(200).json({
                    city: 'Maribor',
                    country: 'Slovenia',
                    location: 'Maribor, Slovenia'
                });
            }

            // Handle private IPs - map to Maribor
            if (normalizedIp.startsWith('192.168.') || 
                normalizedIp.startsWith('10.') || 
                (normalizedIp.startsWith('172.') && this.isPrivateRange(normalizedIp))) {
                return res.status(200).json({
                    city: 'Maribor',
                    country: 'Slovenia',
                    location: 'Maribor, Slovenia'
                });
            }

            // Handle multiple IPs
            if (normalizedIp.includes(',')) {
                normalizedIp = normalizedIp.split(',')[0].trim();
            }

            // Strip IPv6-mapped IPv4 prefix
            if (normalizedIp.startsWith('::ffff:')) {
                normalizedIp = normalizedIp.replace('::ffff:', '');
            }

            // Strip port if present
            if (normalizedIp.includes('.') && normalizedIp.includes(':')) {
                normalizedIp = normalizedIp.split(':')[0];
            }

            // Fetch from ip-api.com (free, no API key needed, 45 req/min)
            try {
                const url = `http://ip-api.com/json/${normalizedIp}`;
                console.log('Fetching from ip-api.com:', url);
                
                const response = await fetch(url);
                const data = await response.json();

                console.log('IP API response:', data);

                if (data.status === 'success') {
                    const city = data.city || 'Unknown';
                    const country = data.country || 'Unknown';
                    const location = city && country ? `${city}, ${country}` : city || country;
                    
                    console.log('Success - Location:', location);
                    
                    return res.status(200).json({
                        city,
                        country,
                        location
                    });
                } else {
                    console.log('IP API failed:', data.message);
                    return res.status(200).json({
                        city: 'Unknown',
                        country: 'Unknown',
                        location: 'Location unavailable'
                    });
                }
            } catch (fetchError: any) {
                console.error('API fetch error:', fetchError.message);
                return res.status(200).json({
                    city: 'Unknown',
                    country: 'Unknown',
                    location: 'Location unavailable'
                });
            }

        } catch (error: Error | any) {
            return res.status(200).json({
                city: 'Unknown',
                country: 'Unknown',
                location: 'Location unavailable'
            });
        }
    }

    private isPrivateRange = (ip: string): boolean => {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4) return false;
        // 172.16.0.0 - 172.31.255.255
        return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
    }

     @Post('/user/login')
    async login(@Body() body: any,@Req() req: any, @Res() res: any) {
        try {
            let findUser = await AppDataSource.manager.getRepository(User)
                .createQueryBuilder("U")
                .where("U.username = :username", { username: body.username })
                .leftJoinAndSelect("U.profileImage","UserImages")
                .leftJoinAndSelect("U.cover_photo","CoverPhoto")
                .leftJoinAndSelect("U.fk_billing_plan_id", "BillingPlan")
                .getOne();
            if (!findUser) {
                throw new Error(`Napaka: Uporabnik z uporabniškim imenom '${body.username}' ne obstaja!`);
            }
            if (!(await bcyrpt.compare(body.password, findUser.password))) {
                throw new Error(`Napaka: Geslo ni pravilno !!!`);
            }
            // Set user online
            findUser.isOnline = true;
            await AppDataSource.manager.save(findUser);

            let session: UserSession = new UserSession();
            session.fk_logged_in_user = findUser;
            session.session_token = crypto.randomBytes(32).toString("base64url");
            const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
            session.ip_adress = ip;

            await AppDataSource.manager.save(session);

            const responseData = {
                message: `Prijava je bila uspešna !`,
                user: findUser,
                session_token: session.session_token
            };

            return res.status(200).json(responseData);
        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Post('/user/toggle-online')
    async toggleOnline(@Body() body: any, @Req() req: any, @Res() res: any) {
        try {
            let { userId, isOnline } = body;
            // ...existing code...
        } catch (error) {
            // ...existing code...
        }
    }

    @Post('/user/register')
    async register(@Body() body: any,@Req() req: any, @Res() res: any) {
        try {
            let saltRounds: number = 10;
            // Check if username or email already exists
            const existingUser = await AppDataSource.manager.getRepository(User)
                .createQueryBuilder("U")
                .where("U.username = :username OR U.email = :email", { username: body.username, email: body.email })
                .getOne();
            if (existingUser) {
                throw new Error("Uporabnik s tem uporabniškim imenom ali emailom že obstaja!");
            }
            let user: User = new User();
            user.first_name = body.first_name;
            user.last_name = body.last_name;
            user.birth_date = body.birthdate;
            user.email = body.email;
            user.username = body.username;
            user.password = await bcyrpt.hash(body.password, saltRounds);
            user.sex = body.sex;
            // Store selected billing plan if provided
            if (body.fk_billing_plan_id) {
                user.fk_billing_plan_id = body.fk_billing_plan_id;
            }
            await AppDataSource.manager.save(user);
            // Generate a session for the new user
            const crypto = require('crypto');
            const sessionToken = crypto.randomBytes(32).toString('hex');
            const userSession = new (require('../entity/UserSession').UserSession)();
            userSession.fk_logged_in_user = user;
            userSession.session_token = sessionToken;
            userSession.ip_adress = req.ip || '';
            userSession.user_agent = req.headers['user-agent'] || '';
            await AppDataSource.manager.save(userSession);
            // Send welcome email (non-blocking)
            try {
                sendWelcomeEmail(user.email, user.username);
            } catch (e) {
                console.error('Failed to send welcome email:', e);
            }
            return res.status(200).json({
                message: "Vaši podatki so bili uspešno ustvarjeni !",
                session_token: sessionToken,
                user: user
            });
        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Get('/user/session/logged/in')
    async get_logged_in_users(@Body() body: any,@Req() req: any, @Res() res: any) {
        try {
            // Prevent caching
            // Only set headers before sending response
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
            const logged_in_users = await AppDataSource.manager
                .getRepository(UserSession)
                .createQueryBuilder("US")
                .leftJoinAndSelect("US.fk_logged_in_user", "User")
                .leftJoinAndSelect("User.profileImage", "ProfileImage")
                .select(["User.id", "User.username", "User.email", "User.first_name", "User.last_name", "ProfileImage.id", "ProfileImage.path"])
                .orderBy('User.birth_date', 'DESC')
                .skip(0)
                .take(20)
                .getMany();
            return res.status(200).json(logged_in_users);
        } catch (error: Error | any) {
            // Only set headers before sending response
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
            return res.status(200).json({
                message: error.message
            });
        }
    }

    @Post('/user/send/request')
    async sendFriendRequest(@Body() data: any, @Req() req: any, @Res() res: any) {
        try {
            const token = req.headers['x-session-token'] as string;
            let currentUser: User | null = null;

            if (token) {
                const session = await AppDataSource.getRepository(UserSession)
                    .createQueryBuilder('s')
                    .leftJoinAndSelect('s.fk_logged_in_user', 'user')
                    .where('s.session_token = :token', { token })
                    .getOne();
                currentUser = session?.fk_logged_in_user || null;
            }

            if (!currentUser) {
                throw new Error(`Napaka: Uporabnik ni avtenticiran!`);
            }

            let targetUser = await AppDataSource.manager.getRepository(User)
                                                    .createQueryBuilder("U")
                                                    .where({
                                                        id: data.fk_user_two_id
                                                    })
                                                    .getOne();

            if (!targetUser) {
                throw new Error(`Napaka: Ciljna oseba ne obstaja!`);
            }

            if (currentUser.id === targetUser.id) {
                throw new Error(`Napaka: Ne morete poslati prošnje za prijateljstvo sebi!`);
            }

            // Check if request already exists
            let existingRequest = await AppDataSource.manager.getRepository(UserFavorites)
                                                        .createQueryBuilder("UF")
                                                        .where('UF.fk_user_one_id = :currentUserId AND UF.fk_user_two_id = :targetUserId', { currentUserId: currentUser.id, targetUserId: targetUser.id })
                                                        .orWhere('UF.fk_user_one_id = :targetUserId AND UF.fk_user_two_id = :currentUserId', { targetUserId: targetUser.id, currentUserId: currentUser.id })
                                                        .getOne();

            if (existingRequest) {
                throw new Error(`Napaka: Prošnja za prijateljstvo že obstaja!`);
            }

            let newRequest: UserFavorites = new UserFavorites();
            newRequest.fk_user_one_id = currentUser;
            newRequest.fk_user_two_id = targetUser;
            newRequest.status = FavoriteStatus.PENDING;


            await AppDataSource.manager.save(newRequest);

            // Store notification in the Notification table
            const notification = new Notification();
            notification.fk_user_id = targetUser;
            notification.type = 'friend';
            notification.title = `${currentUser.username} sent you a friend request!`;
            notification.read = false;
            notification.fk_friends_id = [currentUser];
            await AppDataSource.manager.save(notification);

            // Real-time notification to the target user
            try {
                const { getIO } = require('../socket');
                const io = getIO();
                if (targetUser && targetUser.id) {
                    io.emit(`notification:${targetUser.id}`, {
                        type: 'friend',
                        message: notification.title,
                        from: currentUser.id,
                        fromUsername: currentUser.username
                    });
                }
            } catch (e) {
                // Socket.IO not available, skip real-time emit
            }

            return res.status(200).json({
                message: "Prošnja za prijateljstvo je bila uspešno poslana !"
            })

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }

    }


    @Get('/user/get/request/:username')
    async getRequesByUser(@Param('username') username: string, @Req() req: any, @Res() res: any) {
        try {
            const token = req.headers['x-session-token'] as string;
            let currentUser: User | null = null;

            if (token) {
                const session = await AppDataSource.getRepository(UserSession)
                    .createQueryBuilder('s')
                    .leftJoinAndSelect('s.fk_logged_in_user', 'user')
                    .where('s.session_token = :token', { token })
                    .getOne();
                currentUser = session?.fk_logged_in_user || null;
            }

            if (!currentUser) {
                throw new Error(`Napaka: Uporabnik ni avtenticiran!`);
            }

            let targetUser = await AppDataSource.manager.getRepository(User)
                                                    .createQueryBuilder("U")
                                                    .where({
                                                        username: username
                                                    })
                                                    .getOne();

            if (!targetUser) {
                throw new Error(`Napaka: Uporabnik '${username}' ne obstaja!`);
            }

            let findRequestID = await AppDataSource.manager.getRepository(UserFavorites)
                                                        .createQueryBuilder("UF")
                                                        .leftJoinAndSelect("UF.fk_user_one_id","UserOne")
                                                        .leftJoinAndSelect("UF.fk_user_two_id","UserTwo")
                                                        .where('UF.fk_user_one_id = :currentUserId AND UF.fk_user_two_id = :targetUserId', { currentUserId: currentUser.id, targetUserId: targetUser.id })
                                                        .orWhere('UF.fk_user_one_id = :targetUserId AND UF.fk_user_two_id = :currentUserId', { targetUserId: targetUser.id, currentUserId: currentUser.id })
                                                        .getOne();

            if (!findRequestID) {
                return res.status(200).json({
                    favorites: null,
                    status: null,
                    canAccept: false,
                    sentByMe: false
                });
            }

            const sentByMe = findRequestID.fk_user_one_id.id === currentUser.id;
            const canAccept = findRequestID.fk_user_two_id.id === currentUser.id;

            return res.status(200).json({
                favorites: findRequestID,
                status: findRequestID.status,
                canAccept: canAccept,
                sentByMe: sentByMe
            });

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Get('/user/accept/request/:username')
    async acceptRequest(@Param('username') username: string, @Req() req: any, @Res() res: any) {
        try {
            const token = req.headers['x-session-token'] as string;
            let currentUser: User | null = null;

            if (token) {
                const session = await AppDataSource.getRepository(UserSession)
                    .createQueryBuilder('s')
                    .leftJoinAndSelect('s.fk_logged_in_user', 'user')
                    .where('s.session_token = :token', { token })
                    .getOne();
                currentUser = session?.fk_logged_in_user || null;
            }

            if (!currentUser) {
                throw new Error(`Napaka: Uporabnik ni avtenticiran!`);
            }

           let targetUser = await AppDataSource.manager.getRepository(User)
                                                    .createQueryBuilder("U")
                                                    .where({
                                                        username: username
                                                    })
                                                    .getOne();

            if (!targetUser) {
                throw new Error(`Napaka: Uporabnik '${username}' ne obstaja!`);
            }

            let findRequestID = await AppDataSource.manager.getRepository(UserFavorites)
                                                           .createQueryBuilder("UF")
                                                           .leftJoinAndSelect("UF.fk_user_one_id","UserOne")
                                                           .leftJoinAndSelect("UF.fk_user_two_id","UserTwo")
                                                           .where('UF.fk_user_one_id = :currentUserId AND UF.fk_user_two_id = :targetUserId', { currentUserId: currentUser.id, targetUserId: targetUser.id })
                                                           .orWhere('UF.fk_user_one_id = :targetUserId AND UF.fk_user_two_id = :currentUserId', { targetUserId: targetUser.id, currentUserId: currentUser.id })
                                                           .getOne();

            if (!findRequestID) {
                throw new Error(`Napaka: Zahteva za prijateljstvo ni bila najdena!`);
            }

            if (findRequestID.fk_user_two_id.id !== currentUser.id) {
                throw new Error(`Napaka: Le prejemnik zahteve jo lahko sprejme!`);
            }
            findRequestID.status = FavoriteStatus.ACCEPTED;

            await AppDataSource.manager.save(findRequestID);

            return res.status(200).json({
                message: "Prošnja za prijateljstvo je bila uspešno potrjena!"
            });

        } catch (error: Error  | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }


    @Get('/user/get/favorites/:username')
    async getFavoriteUsers(@Param('username') username: string, @Req() req: any, @Res() res: any) {
        try {

            let findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .where({
                                                        username: username
                                                      })
                                                      .getOne();


            let findRequestID = await AppDataSource.manager.getRepository(UserFavorites)
                                                           .createQueryBuilder("UF")
                                                           .leftJoinAndSelect("UF.fk_user_one_id","User")
                                                           .leftJoinAndSelect("UF.fk_user_two_id","User1")
                                                           .leftJoinAndSelect("User.profileImage","ProfileImage")
                                                           .leftJoinAndSelect("User1.profileImage","ProfileImage1")
                                                           .where({
                                                             fk_user_one_id: findUser,
                                                           })
                                                           .orWhere({
                                                             fk_user_two_id: findUser
                                                           })
                                                           .skip(0)
                                                           .take(20)
                                                           .getMany();


            return res.status(200).json(findRequestID);

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }

    }

    @Get('/user/check/for/session/:username')
    async check_user_session(@Param('username') username: string,@Req() req: any, @Res() res: any) {
        try {

            let findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .where({
                                                        username: username
                                                      })
                                                      .getOne();

            let findSessionUser = await AppDataSource.manager.getRepository(UserFavorites)
                                                             .createQueryBuilder("UF")
                                                             .leftJoinAndSelect("UF.fk_user_one_id","User")
                                                             .leftJoinAndSelect("UF.fk_user_two_id","User1")
                                                             .where({
                                                                fk_user_one_id: findUser
                                                             })
                                                             .orWhere({
                                                                fk_user_two_id: findUser
                                                             })
                                                             .getOne();


            if(findSessionUser)
                 return res.status(200).json(true);

             return res.status(200).json(false);


        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }

    }

   @Get('/user/destroy/session/:username')
    async destroy_loggin_session(@Param('username') username: string,@Req() req: any, @Res() res: any) {
        try {

            let findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .where({
                                                        username: username
                                                      })
                                                      .getOne();

            if(!findUser)
                throw new Error(`Napaka: Za iskanega uporabnika '${username}' ni bilo mogoče najeti podatkov !`)

            let findSession = await AppDataSource.manager.getRepository(UserSession)
                                                         .createQueryBuilder("US")
                                                         .where({
                                                            fk_logged_in_user: findUser
                                                         })
                                                         .getOne();

            if(!findSession)
                throw new Error(`Napaka: Za iskanega uporabnika '${username}' ni bilo mogoče najeti seje !!!`)

            await AppDataSource.manager.remove(findSession);


            return res.status(200).json({
                message: "Odjava je bila uspešna !"
            })

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }

   }

   @Post('/user/upload/cover/photo')
    async upload_cover_photo(@Body()data: any,  @UploadedFiles('cover_photo', { options: fileUploadOptions() }) files: any[], @Req() req: any, @Res() res: any) {
        try {

            let fk_user_id: User = data.fk_user_id as User;
            let cover_photo_file: any = files[0];

            let findUser = await AppDataSource.manager.getRepository(User).findOneBy({
                id: fk_user_id.id
            });

            if(!findUser)
                throw new Error(`Napaka: Za izbranega uporabnika ni bilo mogoče najti podatkov !!!`);


            let newFilePAth = path.join(process.cwd()+`/src/uploads/profiles/${findUser.username}`);

            if(!fs.existsSync(newFilePAth)){
                fs.mkdirSync(newFilePAth, { recursive: true });
            }
            const destPath = path.join(newFilePAth,cover_photo_file.originalname);
            let userImage: UserImages = new UserImages();
            userImage.path = cover_photo_file.filename;
            userImage.fk_user_id = findUser;
            userImage.album_name = 'cover_photo';
            userImage.album_private = true;
            userImage.mimeType = cover_photo_file.mimetype;
            userImage.sizeBytes = cover_photo_file.size;
            userImage.path = `/uploads/profiles/${findUser.username}/${cover_photo_file.filename}`;
            await AppDataSource.manager.save(userImage);

            findUser.cover_photo = userImage;

            await AppDataSource.manager.save(findUser);

            fs.renameSync(cover_photo_file.path, destPath);


            return res.status(200).json({
                message: "Slika je bila uspešno naložena !"
            });


        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }


    @Put('/user/update/information')
    async update_user_information(@Body() data: any, @Req() req: any, @Res() res: any) {
        try {
            let findInformation = await AppDataSource.manager.getRepository(UserInformation)
                                                             .createQueryBuilder("UI")
                                                             .where({
                                                                id: data.id
                                                             })
                                                             .getOne(); 
            if(!findInformation)
                throw new Error(`Napaka: Za iskanega uporabnika ni bilo mogoče najti podatkov !!!`);

            // Update only available fields in UserInformation
            if(data.fk_user_id) findInformation.fk_user_id = data.fk_user_id;

            await AppDataSource.manager.getRepository(UserInformation).save(findInformation);

            return res.status(200).json({
                message: 'Podatki o uporabniku so bili uspešno posodobljeni',
                information: findInformation
            });
        } catch (error: Error | any) {
            return res.status(400).json({
                message: error.message || 'Napaka pri posodabljanju podatkov'
            });
        }
    }

    @Put('/user/update')
    async updateUserBasicInfo(@Body() data: any, @Req() req: any, @Res() res: any) {
        try {

           let findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .where({
                                                        id: data.fk_user_id.id
                                                      })
                                                      .getOne();

            if (!findUser) {
                throw new Error('Napaka: Uporabnika ni bilo mogoče najti');
            }

            // Update basic user information
            if (data.first_name) findUser.first_name = data.first_name;
            if (data.last_name) findUser.last_name = data.last_name;
            if (data.email) findUser.email = data.email;
            if (data.birth_date) findUser.birth_date = data.birth_date;

            // Save updated user
            await AppDataSource.manager.getRepository(User).save(findUser);

            return res.status(200).json({
                message: 'Podatki o uporabniku so bili uspešno posodobljeni',
                user: findUser
            });

        } catch (error: Error | any) {
            return res.status(400).json({
                message: error.message || 'Napaka pri posodabljanju podatkov o uporabniku'
            });
        }
    }

    @Post('/user/info/save')
    async saveUserInformation(@Body() data: any, @Req() req: any, @Res() res: any) {
        try {
            // Find existing UserInformation for this user
            let userInfoRepo = AppDataSource.manager.getRepository(UserInformation);
            let findUserInformation = await userInfoRepo
                .createQueryBuilder("UI")
                .where("UI.fk_user_id = :userId", { userId: typeof data.fk_user_id === 'object' ? data.fk_user_id.id : data.fk_user_id })
                .getOne();

            let userInformation: UserInformation;
            if (findUserInformation) {
                userInformation = findUserInformation;
            } else {
                userInformation = new UserInformation();
                userInformation.fk_user_id = data.fk_user_id;
            }


            // Only allow values for sex_type that are in GenderIdentity enum
            // Fallback to GenderIdentity.NONE if not valid
            const GenderIdentity = {
                CISGENDER: "Cisgender",
                AGENDER: "Agender",
                INTERSEX: "Intersex",
                NONBINARY: "Nonbinary",
                GENDERFLUID: "Genderfluid",
                GENDERQUEER: "Genderqueer",
                TRANSGENDER: "Transgender",
                BIGENDER: "Bigender",
                GENDER_EXPRESSION: "Gender expression",
                ASEXUAL: "Asexual",
                GENDER_BINARY: "Gender binary",
                GENDER_DYSPHORIA: "Gender dysphoria",
                BISEXUAL: "Bisexual",
                DEMIGENDER: "Demigender",
                GAY: "Gay",
                GENDER_NONCONFORMING: "Gender nonconforming",
                OMNIGENDER: "Omnigender",
                PANSEXUAL: "Pansexual",
                QUESTIONING: "Questioning",
                SEXUALITY: "Sexuality",
                ANDROGYNE: "Androgyne",
                CIS_FEMALE: "Cis female",
                FEMALE: "Female",
                MALE: "Male",
                NONE: "none"
            };
            const allowedGenderIdentities = Object.values(GenderIdentity);

            let sexTypeSet = false;
            for (const key of Object.keys(data)) {
                if (key !== 'fk_user_id') {
                    if (key === 'sex_type' && typeof data[key] === 'string') {
                        const val = data[key];
                        const mapped = allowedGenderIdentities.includes(val) ? val : GenderIdentity.NONE;
                        (userInformation as any)[key] = mapped;
                        sexTypeSet = true;
                    } else {
                        (userInformation as any)[key] = data[key];
                    }
                }
            }
            // Ensure sex_type is never null
            if (!sexTypeSet) {
                (userInformation as any)['sex_type'] = GenderIdentity.NONE;
            }

            await userInfoRepo.save(userInformation);
            return res.status(200).json({
                message: 'Podatki o uporabniku so bili uspešno shranjeni',
                information: userInformation
            });
        } catch (error: Error | any) {
            return res.status(400).json({
                message: error.message || 'Napaka pri shranjevanju podatkov o uporabniku'
            });
        }
    }

    @Get('/user/decline/request/:username')
    async declineRequestByUsername(@Param('username') username: string, @Req() req: any, @Res() res: any) {
        try {
            const token = req.headers['x-session-token'] as string;
            let currentUser: User | null = null;
            if (token) {
                const session = await AppDataSource.getRepository(UserSession)
                    .createQueryBuilder('s')
                    .leftJoinAndSelect('s.fk_logged_in_user', 'user')
                    .where('s.session_token = :token', { token })
                    .getOne();
                currentUser = session?.fk_logged_in_user || null;
            }
            if (!currentUser) {
                throw new Error(`Napaka: Uporabnik ni avtenticiran!`);
            }
            let targetUser = await AppDataSource.manager.getRepository(User)
                .createQueryBuilder("U")
                .where({ username })
                .getOne();
            if (!targetUser) {
                throw new Error(`Napaka: Ciljna oseba ne obstaja!`);
            }
            let findRequestID = await AppDataSource.manager.getRepository(UserFavorites)
                .createQueryBuilder("UF")
                .where('(UF.fk_user_one_id = :targetUserId AND UF.fk_user_two_id = :currentUserId) OR (UF.fk_user_one_id = :currentUserId AND UF.fk_user_two_id = :targetUserId)', {
                    targetUserId: targetUser.id,
                    currentUserId: currentUser.id
                })
                .getOne();
            if (!findRequestID) {
                throw new Error('Friend request not found!');
            }
            if (findRequestID.status !== FavoriteStatus.PENDING) {
                throw new Error('Friend request is not pending!');
            }
            findRequestID.status = FavoriteStatus.DECLINED;
            await AppDataSource.manager.save(findRequestID);
            return res.status(200).json({ message: 'Friend request declined.' });
        } catch (error: Error | any) {
            return res.status(401).json({ message: error.message });
        }
    }

    /**
     * Get all users without a billing plan/package
     * GET /users/without-package
     */
    @Get('/users/without-package')
    async getUsersWithoutPackage(@Res() res: any) {
        try {
            const users = await AppDataSource.manager.getRepository(User)
                .createQueryBuilder("U")
                .leftJoinAndSelect("U.profileImage", "ProfileImage")
                .leftJoinAndSelect("U.cover_photo", "coverPhoto")
                .where("U.fk_billing_plan_id IS NULL OR U.fk_billing_plan_id = 0")
                .skip(0)
                .take(20)
                .getMany();
            return res.status(200).json(users);
        } catch (error: any) {
            return res.status(500).json({ message: error.message });
        }
    }

}