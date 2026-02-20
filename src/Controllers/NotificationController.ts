import { User } from './../entity/User';
import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Notification } from '../entity/Notification';
import { Body, Delete, Get, Post, Put, Req, Res, JsonController } from 'routing-controllers';

@JsonController()
export class NotificationController {

        @Post('/notification/friend-request')
        async createFriendRequestNotification(@Body() data: any, @Req() req: any, @Res() res: any) {
          try {
            const fk_user_id: User = data.fk_user_id as User;
            let fk_friends_id: User[] = data.fk_friends_id as User[];
            const title: string = data.title || 'sent you a friend request!';

            // Find recipient
            let recipient = fk_friends_id && fk_friends_id.length > 0 ? fk_friends_id[0] : null;
            if (!recipient || !recipient.id) {
              throw new Error('Recipient user not found');
            }
            let findRecipient = await AppDataSource.manager.getRepository(User)
              .createQueryBuilder("user")
              .where("user.id = :id", { id: recipient.id })
              .getOne();
            if (!findRecipient)
              throw new Error(`User with id ${recipient.id} not found`);

            // Check UserFavorites for friendship status
            const userFavoritesRepo = AppDataSource.getRepository('UserFavorites');
            const favorite = await userFavoritesRepo.findOne({
              where: [
                { fk_user_one_id: fk_user_id.id, fk_user_two_id: recipient.id },
                { fk_user_one_id: recipient.id, fk_user_two_id: fk_user_id.id }
              ]
            });
            if (!favorite || favorite.status !== 'pending') {
              // No pending request, do not send notification
              return res.status(200).json({ message: 'No pending friend request, notification not sent.' });
            }

            const notificationRepo = AppDataSource.getRepository(Notification);
            const newNotification = notificationRepo.create({
              fk_user_id: findRecipient,
              type: 'friend',
              title: title,
              fk_friends_id: [fk_user_id]
            });
            await notificationRepo.save(newNotification);

            // Real-time notification only to recipient
            try {
              const { getIO } = require('../socket');
              const io = getIO();
              io.emit(`notification:${findRecipient.id}`, {
                type: 'friend-request',
                message: `${fk_user_id.username} sent you a friend request!`,
                from: fk_user_id.id,
                fromUsername: fk_user_id.username
              });
            } catch (e) {
              // Socket.IO not available, skip real-time emit
            }

            if (!res.headersSent) {
              return res.status(200).json({ message: 'Friend request notification created successfully' });
            }
          } catch (error: Error | any) {
            if (!res.headersSent) {
                return res.status(401).json({ error: error.message });
            }
          }
        }

         @Get('/notification/user/:id')
        async getUserNotifications(@Req() req: any, @Res() res: any) {
                  const { id } = req.params;
                  const notificationRepo = AppDataSource.getRepository(Notification);
                  // Find notifications where fk_user_id = id
                  const userNotifications = await notificationRepo.find({
                    where: { fk_user_id: { id: Number(id) }, read: false },
                    relations: ['fk_user_id', 'fk_user_id.profileImage', 'fk_friends_id']
                  });

                  // Find notifications where fk_friends_id contains the user
                  // Fix: Use correct column names for join table
                  // notifications_friends has columns: notificationId, fk_friends_id (user id)
                  // Fix: Use correct column name 'userId' for the join table
                  const friendNotifications = await notificationRepo
                    .createQueryBuilder('notification')
                    .leftJoinAndSelect('notification.fk_user_id', 'fk_user_id')
                    .leftJoinAndSelect('fk_user_id.profileImage', 'profileImage')
                    .leftJoinAndSelect('notification.fk_friends_id', 'fk_friends_id')
                    .where(':userId IN (SELECT nf.userId FROM notifications_friends nf WHERE nf.notificationId = notification.id)', { userId: Number(id) })
                    .andWhere('notification.read = false')
                    .skip(0)
                    .take(20)
                    .getMany();

                  // Merge and deduplicate notifications
                  const allNotifications = [...userNotifications, ...friendNotifications.filter(fn => !userNotifications.some(un => un.id === fn.id))];
                  // Map to include profile image path
                  const mapped = allNotifications.map(n => {
                    let profileImage = null;
                    if (n.fk_user_id && n.fk_user_id.profileImage && typeof n.fk_user_id.profileImage === 'object') {
                      if (typeof n.fk_user_id.profileImage.path === 'string' && n.fk_user_id.profileImage.path) {
                        profileImage = n.fk_user_id.profileImage.path;
                      }
                    }
                    return {
                      ...n,
                      profileImage,
                      fromUserId: n.fk_friends_id && n.fk_friends_id.length > 0 ? n.fk_friends_id[0].id : null,
                      fromUsername: n.fk_friends_id && n.fk_friends_id.length > 0 ? n.fk_friends_id[0].username : null
                    };
                  });
                  return res.json(mapped);
      }


        @Post('/notification/create-album-video')          // ...existing code...
        async createAlbumVideo(@Body() data: any, @Req() req: any, @Res() res: any) {
          try {
            const fk_user_id: User = data.fk_user_id as User;
            const title: string = data.title;
            const fk_friends_id: User[] = data.fk_friends_id as User[];
            
            if (!title || typeof title !== 'string' || !title.trim()) {
              throw new Error('Title is required and must be a non-empty string.');
            }

            let findUser = await AppDataSource.manager.getRepository(User)
              .createQueryBuilder("user")
              .where("user.id = :id", { id: fk_user_id.id })
              .getOne();

            if (!findUser)
              throw new Error(`User with id ${fk_user_id.id} not found`);

            const notificationRepo = AppDataSource.getRepository(Notification);
            const newNotification = notificationRepo.create({
              fk_user_id: findUser,
              type: 'other',
              title: title,
              fk_friends_id: fk_friends_id
            });
            await notificationRepo.save(newNotification);

            // Real-time notification to friends
            try {
              const { getIO } = require('../socket');
              const io = getIO();
              // Notify all friends
              if (Array.isArray(fk_friends_id)) {
                fk_friends_id.forEach(friend => {
                  if (friend && friend.id) {
                    console.log(`[NotificationController] Emitting to friend: notification:${friend.id}`);
                    io.emit(`notification:${friend.id}`, {
                      type: 'event',
                      message: title,
                      from: findUser.id,
                      fromUsername: findUser.username
                    });
                  }
                });
              }
              // Also notify the creator
              if (findUser && findUser.id) {
                console.log(`[NotificationController] Emitting to creator: notification:${findUser.id}`);
                io.emit(`notification:${findUser.id}`, {
                  type: 'event',
                  message: title,
                  from: findUser.id,
                  fromUsername: findUser.username
                });
              }
            } catch (e) {
              console.error('[NotificationController] Socket.IO emit error:', e);
            }

            return res.status(200).json({ message: 'Notification created successfully' });
          } catch (error: Error | any) {
            return res.status(401).json({ error: error.message });
          }
        }

        @Put('/notification/:id')
        async updateNotification(@Body() data: any, @Req() req: any, @Res() res: any) {
          const { id } = req.params;
          const { title, read } = data;
          const notificationRepo = AppDataSource.getRepository(Notification);
          const notification = await notificationRepo.findOneBy({ id: Number(id) });
          if (!notification) return res.status(404).json({ error: 'Notification not found' });
          if (title !== undefined) notification.title = title;
          if (read !== undefined) notification.read = read;
          await notificationRepo.save(notification);
          return res.json(notification);
        }

        @Delete('/notification/:id')
        async deleteNotification(@Req() req: any, @Res() res: any) {
          const { id } = req.params;
          const notificationRepo = AppDataSource.getRepository(Notification);
          const notification = await notificationRepo.findOneBy({ id: Number(id) });
          if (!notification) return res.status(404).json({ error: 'Notification not found' });
          await notificationRepo.remove(notification);
          return res.status(204).send();
        }
     
        @Put('/notification/user/:id/read-all')
        async markAllAsRead(@Req() req: any, @Res() res: any) {
          const { id } = req.params;
          const notificationRepo = AppDataSource.getRepository(Notification);
          await notificationRepo.createQueryBuilder()
            .update(Notification)
            .set({ read: true })
            .where('fk_user_id = :id', { id: Number(id) })
            .execute();
          return res.status(200).json({ message: 'All notifications marked as read.' });
        }

}
