import { FavoriteStatus } from './UserController';
import { AppDataSource } from './../data-source';
import { Request, NextFunction } from 'express';
import { JsonController, Post, Body, Req, Res, Get, Delete, UseBefore, UploadedFile, Param, createExpressServer, UploadedFiles } from 'routing-controllers';
import { User } from '../entity/User';
import * as bcyrpt from 'bcryptjs';
import { UserSession } from '../entity/UserSession';
import * as crypto from "crypto";
import multer, { Options } from 'multer';
import path = require('path');
import * as fs from 'fs';
import { UserImages } from '../entity/UserImages';
import { UserFavorites } from '../entity/UserFavorites';
import { News } from '../entity/News';
import { Comment } from '../entity/Comment';
import { Events } from '../entity/Events';
import { EventParticipant } from '../entity/EventParticipant';

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

@JsonController()
export default class EventsController {

    @Get('/events/get')
    async getAllEvents(
        @Req() request: Request,
        @Res() response: any
    ) {
        try  {

            const findEvents = await AppDataSource.getRepository(Events)
                                                   .createQueryBuilder("events")
                                                   .where("events.isBlocked = :isBlocked", { isBlocked: false })
                                                   .leftJoinAndSelect("events.fk_user_id", "user")
                                                   .leftJoinAndSelect("user.profileImage", "profileImage")
                                                   .leftJoinAndSelect("events.fk_album_id", "eventImage")
                                                   .leftJoinAndSelect("events.participants", "participants")
                                                   .leftJoinAndSelect("participants.user", "participantUser")
                                                   .leftJoinAndSelect("participantUser.profileImage", "participantProfileImage")
                                                   .skip(0)
                                                   .take(20)
                                                   .getMany(); 

            if (!response.headersSent) {
                return response.status(200).json(findEvents);
            }

        } catch (error) {
            if (!response.headersSent) {
                return response.status(500).json({ message: error.message });
            }
        }
    }

    @Get('/events/blocked')
    async getAllBlockedEvents(
        @Req() request: Request,
        @Res() response: any
    ) {
        try  {

            const findEvents = await AppDataSource.getRepository(Events)
                                                   .createQueryBuilder("events")
                                                   .where("events.isBlocked = :isBlocked", { isBlocked: true })
                                                   .leftJoinAndSelect("events.fk_user_id", "user")
                                                   .leftJoinAndSelect("user.profileImage", "profileImage")
                                                   .leftJoinAndSelect("events.fk_album_id", "eventImage")
                                                   .leftJoinAndSelect("events.participants", "participants")
                                                   .leftJoinAndSelect("participants.user", "participantUser")
                                                   .leftJoinAndSelect("participantUser.profileImage", "participantProfileImage")
                                                   .skip(0)
                                                   .take(20)
                                                   .getMany(); 

            return response.status(200).json(findEvents);

        } catch (error) {
            return response.status(500).json({ message: error.message });
        }
    }

    @Post('/events/join/:id')
    async joinEvent(
        @Param('id') id: string,
        @Body() body: any,
        @Res() response: any
    ) {
        try {
            const userPayload = typeof body.fk_user_id === 'string'
                ? JSON.parse(body.fk_user_id)
                : body.fk_user_id;

            if (!userPayload?.id) {
                return response.status(400).json({ message: 'Missing user data.' });
            }

            const event = await AppDataSource.getRepository(Events).findOne({ where: { id } });
            if (!event) {
                return response.status(404).json({ message: 'Dogodek ni bil najden.' });
            }

            const user = await AppDataSource.getRepository(User).findOneBy({ id: userPayload.id });
            if (!user) {
                return response.status(404).json({ message: 'Uporabnik ni bil najden.' });
            }

            const participantRepo = AppDataSource.getRepository(EventParticipant);
            const existing = await participantRepo.findOne({ where: { event: { id }, user: { id: user.id } } });

            if (existing) {
                return response.status(200).json({ message: 'Uporabnik je že prijavljen.', participant: existing });
            }

            const participant = new EventParticipant();
            participant.event = event;
            participant.user = user;

            const saved = await participantRepo.save(participant);

            return response.status(200).json({ message: 'Uspešno ste se prijavili na dogodek.', participant: saved });
        } catch (error) {
            return response.status(500).json({ message: error.message });
        }
    }

    @Delete('/events/participants/remove/:eventId/:userId')
    async removeParticipant(
        @Param('eventId') eventId: string,
        @Param('userId') userId: number,
        @Res() response: any
    ) {
        try {
            const participantRepo = AppDataSource.getRepository(EventParticipant);
            const existing = await participantRepo.findOne({ where: { event: { id: eventId }, user: { id: userId } } });

            if (!existing) {
                return response.status(404).json({ message: 'Udeleženec ni bil najden.' });
            }

            await participantRepo.remove(existing);

            return response.status(200).json({ message: 'Udeleženec je bil odstranjen.' });
        } catch (error) {
            return response.status(500).json({ message: error.message });
        }
    }

    @Post('/events/create')
    async create_event(
        @UploadedFiles('event_images', { options: fileUploadOptions() }) files: Express.Multer.File[],
        @Req() request: Request,
        @Res() response: any,
        @Body() body: any
    ){

        try {

            if(files.length <= 0)
                throw new Error("Preden želite ustvariti dogodek, morate najprej izbrati vsaj eno sliko !!!");

            let user: User = JSON.parse(body.fk_user_id) as User;
            let findUser = await AppDataSource.getRepository(User).findOneBy({ id: user.id });

            if(!findUser)
                throw new Error("Uporabnik ni bil najden v sistemu. Prosimo, osvežite stran in poskusite znova !!!");

            const albumName = `event-${Date.now()}`;
            const filePath = path.join(process.cwd(), 'src', 'uploads', 'profiles', user.username, 'events', albumName);
            // Če datoteka ne obstaja jo ustvari 
            if(!fs.existsSync(filePath)){
                fs.mkdirSync(filePath, { recursive: true });
            }

            const destPath = path.join(filePath, files[0].originalname);
            fs.renameSync(files[0].path, destPath);

            let UI: UserImages = new UserImages();
            UI.album_name = albumName;
            UI.fk_user_id = findUser;
            UI.createdAt = new Date();
            UI.album_private = false;
            UI.path = `/uploads/profiles/${user.username}/events/${albumName}/${files[0].originalname}`
            
            await AppDataSource.getRepository(UserImages).save(UI);

            let event: Events = new Events();
            event.fk_user_id = findUser;
            event.fk_album_id = UI;
            event.title = body.title;
            event.start_date = new Date(body.start);
            event.end_date = new Date(body.end);
            event.description = body.description;

            await AppDataSource.getRepository(Events).save(event);
            return response.status(200).json({ message: 'Dodan nov dogodek v sistem !!!' });

        } catch (error) {
            return response.status(500).json({ message: error.message });
        }


    }

    @Delete('/events/delete/:id')
    async deleteEvent(
        @Param('id') id: string,
        @Res() response: any
    ) {
        try {
            const eventsRepo = AppDataSource.getRepository(Events);
            const imagesRepo = AppDataSource.getRepository(UserImages);

            const event = await eventsRepo.findOne({
                where: { id },
                relations: { fk_album_id: true }
            });

            if (!event) {
                return response.status(404).json({ message: 'Dogodek ni bil najden.' });
            }

            const eventImage = event.fk_album_id;

            await eventsRepo.remove(event);

            if (eventImage) {
                if (eventImage.path) {
                    const relativePath = eventImage.path.replace(/^\/+/, '');
                    const filePath = path.join(process.cwd(), 'src', relativePath);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        const dirPath = path.dirname(filePath);
                        if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
                            fs.rmdirSync(dirPath);
                        }
                    }
                }
                await imagesRepo.remove(eventImage);
            }

            return response.status(200).json({ message: 'Dogodek je bil izbrisan.' });
        } catch (error) {
            return response.status(500).json({ message: error.message });
        }
    }


    @Post('/events/block/:id')
    async blockEvent(
        @Param('id') id: string | number,
        @Res() response: any
    ) {
        try {
        

            let findEvent =  await AppDataSource.manager.getRepository(Events)
                                                        .createQueryBuilder("events")
                                                        .where("events.id = :id", { id: String(id) })
                                                        .getOne();

            if(!findEvent) 
                return response.status(404).json({ message: 'Dogodek ni bil najden.' });

            findEvent.isBlocked = true;
            await AppDataSource.manager.save(findEvent);

            return response.status(200).json({
                message: "Dogodek ste uspešno blokriali !!!"
            })

        }catch(error) {
            return response.status(500).json({ message: error.message });
        }
    }



    @Post('/events/unblock/:id')
    async unblockEvent(
        @Param('id') id: string | number,
        @Res() response: any
    ) {
        try {
        

            let findEvent =  await AppDataSource.manager.getRepository(Events)
                                                        .createQueryBuilder("events")
                                                        .where("events.id = :id", { id: String(id) })
                                                        .getOne();

            if(!findEvent) 
                return response.status(404).json({ message: 'Dogodek ni bil najden.' });

            findEvent.isBlocked = false;
            await AppDataSource.manager.save(findEvent);

            return response.status(200).json({
                message: "Dogodek ste uspešno odblokirali !!!"
            })

        }catch(error) {
            return response.status(500).json({ message: error.message });
        }
    }

}