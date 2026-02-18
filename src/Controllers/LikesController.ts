import { User } from './../entity/User';
import { AppDataSource } from './../data-source';
import { Request, Response, NextFunction } from 'express';
import { JsonController, Post, Body, Req, Res, Get, Delete, UseBefore, UploadedFile, Param, createExpressServer } from 'routing-controllers';
import * as bcyrpt from 'bcrypt';
import { UserSession } from '../entity/UserSession';
import * as crypto from "crypto";
import * as multer from 'multer';
import type { Options } from 'multer';
import path = require('path');
import * as fs from 'fs';
import { UserImages } from '../entity/UserImages';
import type { Express } from 'express';
import { UserFavorites } from '../entity/UserFavorites';
import { UserInformation } from '../entity/UserInformation';
import { Likes } from '../entity/Likes';
import { News } from '../entity/News';
import { Comment } from '../entity/Comment';
import { Message } from '../entity/Message';
import { Conversation } from '../entity/Conversation';
import { NewsCategory } from '../entity/NewsCategory';
import { Events } from '../entity/Events';

const allowed = [
  'image/jpeg','image/png','image/webp','image/gif',
  'image/avif','image/svg+xml','image/heic','image/heif'
];

const fileUploadOptions = (): Options => ({
  storage: multer.diskStorage({
    destination: path.join(process.cwd(), 'uploads'),
    filename: (_req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
  }),
  limits: { fileSize: 150 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'), false);
  },
});

@JsonController()
export default class LikesController {

    @Get('/likes/count/:target_id')
    async getLikesCount(
      @Param('target_id') target_id: string,
        @Res() response: Response,
        @Req() request: Request
    ) {
        try {

            let findLikes = await AppDataSource.getRepository(Likes)
                                        .createQueryBuilder("likes")
                                        .where("likes.target_id = :target_id", { target_id: target_id })
                                        .getMany();


            return response.status(200).json({ likes_count: findLikes.length });
        } catch (error) {
            return response.status(401).json({ message: error.message });
        }
    }

    @Post('/likes/set/like')
    async setLike(
        @Body() body: any,
        @Res() response: Response,
        @Req() request: Request
    ) {
        try {
           // const { fk_user_id, target_type, target_id } = body;
            const fk_user_id: User = body.fk_user_id as User
            const target_type: string = body.target_type as string;
            const target_id: string = String(body.target_id);

            let findUser = await AppDataSource.getRepository(User).findOneBy({ id: fk_user_id.id });
            if (!findUser) {
                throw new Error('Napaka: Uporabnik ni najden!');
            }

            let Like: Likes = new Likes();
            Like.fk_user_id = findUser;
            Like.target_type = target_type;
            switch(target_type) {
                case 'News':
                    let findNews = await AppDataSource.getRepository(News)
                                                        .createQueryBuilder("news")
                                                        .where("news.title = :title", { title: target_id })
                                                        .getOne();

                    if (!findNews) {
                        throw new Error('Napaka: Ciljni objekt za novice ni najden!');
                    }
                    Like.target_id = String(findNews.id);
                    break;
                case 'UserImages':
                    const isNumericId = /^\d+$/.test(String(target_id));
                    let findAlbumImage = isNumericId
                      ? await AppDataSource.getRepository(UserImages)
                        .createQueryBuilder("user_images")
                        .where("user_images.id = :id", { id: Number(target_id) })
                        .getOne()
                      : await AppDataSource.getRepository(UserImages)
                        .createQueryBuilder("user_images")
                        .where("user_images.album_name = :name", { name: target_id })
                        .getOne();

                        if (!findAlbumImage) {
                            throw new Error('Napaka: Ciljni objekt za slike ni najden!');
                        }

                        Like.target_id = String(findAlbumImage.id);
                    break;
                case 'Comment':
                        let findComment = await AppDataSource.getRepository(Comment)
                                                                .createQueryBuilder("comment")
                                                                .where("comment.id = :id", { id: target_id })
                                                                .getOne();

                        if (!findComment) {
                            throw new Error('Napaka: Ciljni objekt za komentar ni najden!');
                        }

                        Like.target_id = String(findComment.id);
                    break;
                case "Message":
                    let findMessage = await AppDataSource.manager.getRepository(Message)
                                            .createQueryBuilder("M")
                                            .where("M.id = :id", { id: target_id })
                                            .getOne();

                    if (!findMessage) {
                      throw new Error('Napaka: Ciljni objekt za sporočilo ni najden!');
                    }

                    Like.target_id = String(findMessage.id);

                  break;
                  case "MessageItems":

                        let findMessageItem = await AppDataSource.manager.getRepository(Message)
                                                                      .createQueryBuilder("M")
                                                                      .where("M.id = :id", { id: target_id })
                                                                      .getOne();
                        if (!findMessageItem) {
                            throw new Error('Napaka: Ciljni objekt za element sporočila ni najden!');
                        }

                        Like.target_id = String(findMessageItem.id);



                        break;
                  case 'NewsCategory':

                        let findNewsCategory = await AppDataSource.getRepository(NewsCategory)
                                                                .createQueryBuilder("news_category")
                                                                .where("news_category.id = :id", { id: target_id })
                                                                .getOne();

                        if (!findNewsCategory) {
                            throw new Error('Napaka: Ciljni objekt za kategorijo novic ni najden!');
                        }

                        Like.target_id = String(findNewsCategory.id);

                    break;
                case "Events":

                    let findEvent = await AppDataSource.getRepository(Events)
                                                        .createQueryBuilder("events")
                                                        .where("events.id = :id", { id: target_id })
                                                        .getOne();


                        if (!findEvent) {
                            throw new Error('Napaka: Ciljni objekt za dogodek ni najden!');
                        }

                        Like.target_id = String(findEvent.id);



                    break;

                // Add more cases for different target types if necessary
                default:
                    throw new Error('Napaka: Neveljaven tip cilja!');
            }



            await AppDataSource.manager.save(Like);

            return response.status(200).json({ message: 'Izbran objekt ste uspešno všečkali !!' });

        } catch (error) {
            return response.status(401).json({ message: error.message });
        }
    }

    @Post('/likes/counts')
    async getCounts(
      @Body() body: any,
      @Res() response: Response,
      @Req() request: Request
    ) {
      try {
        const target_type: string = body.target_type;
        const target_ids: string[] = Array.isArray(body.target_ids)
          ? body.target_ids.map((v: any) => String(v)).filter((v: string) => v.length > 0)
          : [];

        if (!target_type) {
          return response.status(400).json({ message: 'Missing target_type' });
        }

        if (target_ids.length === 0) {
          return response.status(200).json({ counts: {} });
        }

        const rows: Array<{ target_id: string; cnt: string }> = await AppDataSource.getRepository(Likes)
          .createQueryBuilder('l')
          .select('l.target_id', 'target_id')
          .addSelect('COUNT(*)', 'cnt')
          .where('l.target_type = :type', { type: target_type })
          .andWhere('l.target_id IN (:...ids)', { ids: target_ids })
          .andWhere('l.deleted_at IS NULL')
          .groupBy('l.target_id')
          .getRawMany();

        const counts: Record<string, number> = {};
        // initialize zeros for all requested ids
        for (const id of target_ids) counts[id] = 0;
        // fill with DB results
        for (const r of rows) counts[String(r.target_id)] = Number(r.cnt);

        return response.status(200).json({ counts });
      } catch (error: any) {
        return response.status(500).json({ message: error.message });
      }
    }
}