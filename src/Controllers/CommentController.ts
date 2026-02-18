import { AppDataSource } from './../data-source';
import { Request, Response, NextFunction } from 'express';
import { JsonController, Post, Body, Req, Res, Get, Delete, UseBefore, UploadedFile, Param, createExpressServer, UploadedFiles } from 'routing-controllers';
import { User } from '../entity/User';
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
import { News } from '../entity/News';
import { Comment } from '../entity/Comment';

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

const upload = multer(fileUploadOptions());

@JsonController()
export default class CommentController {

@Post('/comments/send')
async sendComment(
  @Req() request: Request,
  @Res() response: Response,
  @Body() data: any
) {
  try {
    // Validate existence without loading entire entities (optional but recommended)
    const userExists = await AppDataSource.manager.getRepository(User)
                                                  .createQueryBuilder("User")
                                                  .leftJoinAndSelect("User.profileImage", "ProfileImage")
                                                  .where("User.id = :userID", { userID: data.fk_user_id.id })
                                                  .getOne();


    if (!userExists) throw new Error("Napaka: Iskan uporabnik ni bil najden v sistemu !!!");

    const newsExists = await AppDataSource.getRepository(News).exists({ where: { id: data.fk_news_id.id } });
    if (!newsExists) throw new Error("Napaka: Izbrana novica ni bila najdena v sistemu !!!");

    // Save comment by relation IDs — avoids persisting User or News objects
    let c: Comment = new Comment();
    c.body = data.body;
    c.fk_user_id = data.fk_user_id;
    c.fk_news_id = data.fk_news_id;
    
    await AppDataSource.getRepository(Comment).save(c);

    return response.status(200).json({ message: "Izbrana novica je bila uspešno komentirana !!!" });
  } catch (error: any) {
    return response.status(401).json({ message: error.message });
  }
}

@Post('/comments/send/video')
async sendVideoComment(
    @Req() request: Request,
    @Res() response: Response,
    @Body() data: any
) {
    try {
        const userExists = await AppDataSource.manager.getRepository(User)
                                                                                                    .createQueryBuilder("User")
                                                                                                    .leftJoinAndSelect("User.profileImage", "ProfileImage")
                                                                                                    .where("User.id = :userID", { userID: data.fk_user_id.id })
                                                                                                    .getOne();

        if (!userExists) throw new Error("Napaka: Iskan uporabnik ni bil najden v sistemu !!!");

        const videoExists = await AppDataSource.getRepository(UserImages).exists({ where: { id: data.fk_video_id.id } });
        if (!videoExists) throw new Error("Napaka: Izbran video ni bil najden v sistemu !!!");

        let c: Comment = new Comment();
        c.body = data.body;
        c.fk_user_id = data.fk_user_id;
        c.fk_video_id = data.fk_video_id;

        await AppDataSource.getRepository(Comment).save(c);

        return response.status(200).json({ message: "Video je bil uspešno komentiran !!!" });
    } catch (error: any) {
        return response.status(401).json({ message: error.message });
    }
}

    @Get('/comments/get/:newsID')
    async getCommentsForNews(
        @Req() request: Request,
        @Res() response: Response, 
        @Param('newsID') newsID: number
    ) {
        try {   

            let comments = await AppDataSource.manager.getRepository(Comment)
                                                        .createQueryBuilder('C')
                                                        .leftJoinAndSelect('C.fk_user_id', 'User')                 // load user relation
                                                        .leftJoinAndSelect('User.profileImage', 'ProfileImage')   // load user's profileImage relation
                                                        .where('C.fk_news_id = :newsID', { newsID })
                                                        .andWhere('C.blocked = 0')
                                                        .andWhere('C.deleted_at IS NULL')
                                                        .orderBy('C.created_at', 'DESC')
                                                        .getMany();                    
            return response.status(200).json(comments);


        }   catch (error) {     
            return response.status(401).json({ message: error.message });
        }
    }

    @Get('/comments/get/video/:videoID')
    async getCommentsForVideo(
        @Req() request: Request,
        @Res() response: Response, 
        @Param('videoID') videoID: number
    ) {
        try {   

            let comments = await AppDataSource.manager.getRepository(Comment)
                                                        .createQueryBuilder('C')
                                                        .leftJoinAndSelect('C.fk_user_id', 'User')
                                                        .leftJoinAndSelect('User.profileImage', 'ProfileImage')
                                                        .where('C.fk_video_id = :videoID', { videoID })
                                                        .andWhere('C.blocked = 0')
                                                        .andWhere('C.deleted_at IS NULL')
                                                        .orderBy('C.created_at', 'DESC')
                                                        .getMany();
            return response.status(200).json(comments);


        }   catch (error) {     
            return response.status(401).json({ message: error.message });
        }
    }

    @Delete('/comments/delete/:commentID')
    async deleteComment(
        @Req() request: Request,
        @Res() response: Response, 
        @Param('commentID') commentID: number
    ) {
        try {
            let findComment = await AppDataSource.getRepository(Comment).findOneBy({ id: commentID });
            if (!findComment) 
                throw new Error("Napaka: Izbran komentar ni bil najden v sistemu !!!");

            await AppDataSource.getRepository(Comment)
                                .createQueryBuilder("C")
                                .delete()
                                .from(Comment)
                                .where("id = :commentID", { commentID })
                                .execute();

            return response.status(200).json({ message: "Komentar je bil uspešno izbrisan iz sistema !!!" });

        }   catch (error) {     
            return response.status(401).json({ message: error.message });
        }
    }

    @Get('/comments/block/:commentID')
    async blockComment(
        @Req() request: Request,
        @Res() response: Response, 
        @Param('commentID') commentID: number
    ) {
        try {
            let findComment = await AppDataSource.getRepository(Comment).findOneBy({ id: commentID });
            if (!findComment) 
                throw new Error("Napaka: Izbran komentar ni bil najden v sistemu !!!");

            findComment.blocked = true;
            await AppDataSource.getRepository(Comment).save(findComment);

            return response.status(200).json({ message: "Komentar je bil uspešno blokiran !!!" });

        }
        catch (error) {
            return response.status(401).json({ message: error.message });
        }
    }

    @Get('/comments/blocked')
    async getBlockedComments(
        @Req() request: Request,
        @Res() response: Response
    ) {
        try {

            let comments =  await AppDataSource.manager.getRepository(Comment)
                                                        .createQueryBuilder('C')
                                                        .leftJoinAndSelect('C.fk_user_id', 'User')                 // load user relation
                                                        .leftJoinAndSelect('User.profileImage', 'ProfileImage')   // load user's profileImage relation  
                                                        .where('C.blocked = 1')
                                                        .andWhere('C.deleted_at IS NULL')
                                                        .orderBy('C.created_at', 'DESC')
                                                        .getMany(); 
            

            return response.status(200).json(comments);

        }   catch (error) {     
            return response.status(401).json({ message: error.message });
        }   
    }

    @Get('/comments/blocked/video')
    async getBlockedVideoComments(
        @Req() request: Request,
        @Res() response: Response
    ) {
        try {
            let comments =  await AppDataSource.manager.getRepository(Comment)
                                                        .createQueryBuilder('C')
                                                        .leftJoinAndSelect('C.fk_user_id', 'User')
                                                        .leftJoinAndSelect('User.profileImage', 'ProfileImage')
                                                        .leftJoinAndSelect('C.fk_video_id', 'Video')
                                                        .where('C.blocked = 1')
                                                        .andWhere('C.deleted_at IS NULL')
                                                        .andWhere('C.fk_video_id IS NOT NULL')
                                                        .orderBy('C.created_at', 'DESC')
                                                        .getMany(); 

            return response.status(200).json(comments);

        }   catch (error) {     
            return response.status(401).json({ message: error.message });
        }   
    }

    @Get('/comments/unblock/:commentID')    
    async unblockComment(
        @Req() request: Request,
        @Res() response: Response, 
        @Param('commentID') commentID: number
    ) {
        try {
            let findComment = await AppDataSource.getRepository(Comment).findOneBy({ id: commentID });
            if (!findComment) 
                throw new Error("Napaka: Izbran komentar ni bil najden v sistemu !!!"); 
            findComment.blocked = false;
            await AppDataSource.getRepository(Comment).save(findComment);   
            return response.status(200).json({ message: "Komentar je bil uspešno odblokiran !!!" });

        }   catch (error) {    
            return response.status(401).json({ message: error.message });
        }       
    }
}