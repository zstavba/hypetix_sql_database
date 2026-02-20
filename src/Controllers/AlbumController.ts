import { AppDataSource } from './../data-source';
import type { Request, NextFunction } from 'express';
import { JsonController, Post, Body, Req, Res, Get, Delete, UseBefore, UploadedFile, Param, createExpressServer, UploadedFiles, Put } from 'routing-controllers';
import { User } from '../entity/User';
import * as bcyrpt from 'bcryptjs';
import { UserSession } from '../entity/UserSession';
import * as crypto from "crypto";
import multer, { Options } from 'multer';
import path = require('path');
import * as fs from 'fs';
import { UserImages } from '../entity/UserImages';
import { UserFavorites } from '../entity/UserFavorites';
import { Message } from '../entity/Message';
import { Comment } from '../entity/Comment';

const allowed = [
  'image/jpeg','image/png','image/webp','image/gif',
    'image/avif','image/svg+xml','image/heic','image/heif',
    'video/mp4','video/quicktime','video/webm','video/ogg',
    'video/x-msvideo','video/x-ms-wmv','video/mpeg'
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
export default class AlbumController {

    @Post('/user/upload/images')
    async uploadFiles(@UploadedFiles('images', { options: fileUploadOptions() }) files: Express.Multer.File[], @Body() data: any, @Req() req: Request, @Res() res: any ) {    
        try {
            let user_data = JSON.parse(data.fk_user_id);
            let user = user_data as User;
            
            let findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .where({
                                                        username: user.username
                                                      })
                                                      .getOne();
                                
            if(!findUser)
                throw new Error(`Napaka: Za iskanega uporabnika ni bilo mogoče najti podatkov !!!`);

            if(files.length <= 0)
                throw new Error(`Napaka: Seznam slik je prazen. Izbreite vsaj eno sliko !!! `)
                
            const isPrivate = data.private === true || data.private === "true" || data.private === 1 || data.private === "1";
            const albumName = data.album_name ?? null;

            if(data.image_type == "profile_image"){
               let filePath = path.join(process.cwd()+`/src/uploads/profiles/${user.username}/`);
               // Če datoteka ne obstaja jo ustvari 
               if(!fs.existsSync(filePath)){
                    fs.mkdirSync(filePath, { recursive: true });
               }

               for(let file of files){

                const destPath = path.join(filePath,file.originalname);
                fs.renameSync(file.path, destPath);
                let findImage = await AppDataSource.manager.getRepository(UserImages)
                                                               .createQueryBuilder("UI")
                                                               .where({
                                                                fk_user_id: user
                                                               })
                                                               .getOne();
                
                    if(findImage){
                        findImage.path  = `/uploads/profiles/${user.username}/${file.originalname}`;
                        findImage.album_name = albumName; 
                        findImage.album_private = isPrivate;
                        findUser.profileImage = findImage;
                        await AppDataSource.manager.save(findUser);                        
                        await AppDataSource.manager.save(findImage);
                        
                    }

                    let UI: UserImages = new UserImages();
                    UI.fk_user_id = user; 
                    UI.mimeType = file.mimetype; 
                    UI.path = `/uploads/profiles/${user.username}/${file.originalname}`;
                    UI.sizeBytes = file.size;
                    UI.album_name = albumName;
                    UI.album_private = isPrivate;
                    await AppDataSource.manager.save(UI);
                    findUser.profileImage = UI;
                    await AppDataSource.manager.save(findUser);

               }


            }
           
            if(data.image_type == 'album'){
               let newFilePAth = path.join(process.cwd()+`/src/uploads/albums/${data.album_name}/`);
                if(!fs.existsSync(newFilePAth))
                    fs.mkdirSync(newFilePAth, { recursive: true });
                


                for(let file of files){
                    const destPath = path.join(newFilePAth,file.originalname);
                    let UI: UserImages = new UserImages();
                    UI.fk_user_id = user; 
                    UI.mimeType = file.mimetype; 
                    UI.path = `/uploads/albums/${data.album_name}/${file.originalname}`;
                    UI.sizeBytes = file.size;
                    UI.album_name = albumName;
                    UI.album_private = isPrivate;
                    await AppDataSource.manager.save(UI);
                    findUser.profileImage = UI;
                    await AppDataSource.manager.save(findUser);
                
                    fs.renameSync(file.path, destPath);

                }


            }

            if(data.image_type == "cover"){
               let filePath = path.join(process.cwd()+`/src/uploads/profiles/${user.username}/`);
               // Če datoteka ne obstaja jo ustvari 
               if(!fs.existsSync(filePath)){
                    fs.mkdirSync(filePath, { recursive: true });
               }

               for(let file of files){

                const destPath = path.join(filePath,file.originalname);
                fs.renameSync(file.path, destPath);
                let findImage = await AppDataSource.manager.getRepository(UserImages)
                                                               .createQueryBuilder("UI")
                                                               .where({
                                                                fk_user_id: user
                                                               })
                                                               .getOne();
                
                    if(findImage){
                        findImage.path  = `/uploads/profiles/${user.username}/${file.originalname}`;
                        findImage.album_name = albumName; 
                        findImage.album_private = isPrivate;
                        findUser.cover_photo = findImage;
                        await AppDataSource.manager.save(findUser);                        
                        await AppDataSource.manager.save(findImage);
                        
                    }

                    let UI: UserImages = new UserImages();
                    UI.fk_user_id = user; 
                    UI.mimeType = file.mimetype; 
                    UI.path = `/uploads/profiles/${user.username}/${file.originalname}`;
                    UI.sizeBytes = file.size;
                    UI.album_name = albumName;
                    UI.album_private = isPrivate;
                    await AppDataSource.manager.save(UI);
                    findUser.cover_photo = UI;
                    await AppDataSource.manager.save(findUser);

               }


            }


            // Emit notification event if notification data is present
            if (data.notification && data.notification.title && data.notification.fk_user_id && data.notification.fk_friends_id) {
                try {
                    const { getIO } = require('../socket');
                    const io = getIO();
                    const title = data.notification.title;
                    const fk_user_id = data.notification.fk_user_id;
                    const fk_friends_id = data.notification.fk_friends_id;
                    // Notify all friends
                    if (Array.isArray(fk_friends_id)) {
                        fk_friends_id.forEach(friend => {
                            if (friend && friend.id) {
                                console.log(`[AlbumController] Emitting to friend: notification:${friend.id}`);
                                io.emit(`notification:${friend.id}`, {
                                    type: 'event',
                                    message: title,
                                    from: fk_user_id.id,
                                    fromUsername: fk_user_id.username
                                });
                            }
                        });
                    }
                    // Also notify the creator
                    if (fk_user_id && fk_user_id.id) {
                        console.log(`[AlbumController] Emitting to creator: notification:${fk_user_id.id}`);
                        io.emit(`notification:${fk_user_id.id}`, {
                            type: 'event',
                            message: title,
                            from: fk_user_id.id,
                            fromUsername: fk_user_id.username
                        });
                    }
                } catch (e) {
                    console.error('[AlbumController] Socket.IO emit error:', e);
                }
            }
            if (!res.headersSent) {
                return res.status(200).json({
                    message: "Slike so bile uspešno naložene."
                });
            }

        } catch (error: Error | any) {
            if (!res.headersSent) {
                return res.status(401).json({
                    message: error.message
                });
            }
        }
        
    }
    @Get('/user/album/get/:username')
    async getUploadedImages(@Param('username') username: string, @Body() data: any, @Req() req: Request, @Res() res: any ) 
    {
        try {

            let findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .where({
                                                        username: username
                                                      })
                                                      .getOne();

            if(!findUser)
                throw new Error(` Napaka: Za iskanega uporabnika '${username}' ni bilo mogoče najti slik ! `)

            const rows = await AppDataSource.manager.getRepository(UserImages)
                                                    .createQueryBuilder("UI")
                                                    .leftJoinAndSelect("UI.fk_user_id","Users")
                                                    .where({ fk_user_id: findUser }) // 👈 make sure to use the user.id here
                                                    .skip(0)
                                                    .take(20)
                                                    .getMany();
             if(rows.length <= 0)
                throw new Error(` Napaka za iskanega uporabnika '${username}' ni bilo mogoče najti dobenih slik !!!  `)                                       


            const grouped = rows.reduce((acc, img) => {
            let test = img.album_name ?? "Uncategorized";
            (acc[test] ||= []).push(img);
            return acc;
            }, {} as Record<string, UserImages[]>);
    


            return res.status(200).json(grouped)
        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }

    }

    @Get('/user/album/get')
    async get_all_images(@Req() req: any, @Res() res: any){
        try {
            const page = parseInt((req as any).query.page) > 0 ? parseInt((req as any).query.page) : 1;
            const limit = 20;
            const skip = (page - 1) * limit;
            const rows = await AppDataSource.manager.getRepository(UserImages)
                .createQueryBuilder("UI")
                .leftJoinAndSelect("UI.fk_user_id","User")
                .leftJoinAndSelect("User.profileImage","ProfileImage")
                .select(["UI.id", "UI.album_name", "UI.path", "User.id", "User.username", "ProfileImage.id", "ProfileImage.path"])
                .skip(skip)
                .take(limit)
                .getMany();

            if(rows.length <= 0)
                throw new Error(`Napaka: Seznam slike je trenutno prazen !!!`)

            const grouped = rows.reduce((acc, img) => {
                let test = img.album_name ?? "Uncategorized";
                (acc[test] ||= []).push(img);
                return acc;
            }, {} as Record<string, UserImages[]>);

            return res.status(200).json(grouped);

        }catch (error: Error | any){
            return res.status(401).json({
                message: error.message
            });
        }
    }
   @Get('/user/album/get/by/:album_name')
    async get_images_by_album_name (@Param('album_name') album_name: string, @Req() req: any,@Res() res: any){
        try {

            const page = parseInt((req as any).query.page) > 0 ? parseInt((req as any).query.page) : 1;
            const limit = 20;
            const skip = (page - 1) * limit;
            let findImages = await AppDataSource.manager.getRepository(UserImages)
                .createQueryBuilder("UI")
                .leftJoinAndSelect("UI.fk_user_id","User")
                .leftJoinAndSelect("User.profileImage","ProfileImage")
                .where({
                    album_name: album_name
                })
                .skip(skip)
                .take(limit)
                .getMany();

            return res.status(200).json(findImages);


        } catch(error: Error | any ){
            return res.status(401).json({
                message: error.message
            });
        }
    }


    @Post('/user/album/set/private/public/:album_name')
    async set_album_private_public (@Param('album_name') album_name: string, @Body() body: any, @Req() req: Request, @Res() res: any){
        try {
        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }   

    @Delete('/user/album/delete/:album_name')
    async delete_user_album (@Param('album_name') album_name: string, @Req() req: any, @Res() res: any) {
        try {

           const page = parseInt((req as any).query.page) > 0 ? parseInt((req as any).query.page) : 1;
           const limit = 20;
           const skip = (page - 1) * limit;
           let findAlbum =  await AppDataSource.manager.getRepository(UserImages)
                .createQueryBuilder("UI")
                .where({
                    album_name: album_name
                })
                .skip(skip)
                .take(limit)
                .getMany();

            if(findAlbum.length <= 0)
                throw new Error(` Napaka: Iskan album ne obstaja !!! `)

            for(let album of findAlbum){
                let deleteImage = await AppDataSource.manager.getRepository(UserImages)
                                                             .createQueryBuilder("UI")
                                                             .delete()
                                                             .from(UserImages)
                                                             .where({
                                                                id: album.id
                                                             })
                                                             .execute();
            }

            return res.status(200).json({
                message: "Vse izbrane slike so bile uspešno izbrisane !!!"
            });

        } catch (error: Error | any) {
            return res.status(401)
        }
    }

    @Get('/user/album/private/images/:private')
    async get_image_by_private_type (@Param('private') album_private: boolean,  @Req() req: any, @Res() res: any){
        try{

            const page = parseInt((req as any).query.page) > 0 ? parseInt((req as any).query.page) : 1;
            const limit = 20;
            const skip = (page - 1) * limit;
            const rows = await AppDataSource.manager.getRepository(UserImages)
                .createQueryBuilder("UI")
                .leftJoinAndSelect("UI.fk_user_id","User")
                .leftJoinAndSelect("User.profileImage","ProfileImage")
                .where({
                    album_private: album_private
                })
                .skip(skip)
                .take(limit)
                .getMany();

            if(rows.length <= 0)
                throw new Error(`Napaka: Seznam slike je trenutno prazen !!!`)

            const grouped = rows.reduce((acc, img) => {
                let test = img.album_name ?? "Uncategorized";
                (acc[test] ||= []).push(img);
                return acc;
            }, {} as Record<string, UserImages[]>);

            return res.status(200).json(grouped);

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Get('/user/album/public/images')
    async get_only_public_images(@Req() req: any, @Res() res: any){
        try {
            const page = parseInt((req as any).query.page) > 0 ? parseInt((req as any).query.page) : 1;
            const limit = 20;
            const skip = (page - 1) * limit;
            const rows = await AppDataSource.manager.getRepository(UserImages)
                .createQueryBuilder("UI")
                .leftJoinAndSelect("UI.fk_user_id","User")
                .leftJoinAndSelect("User.profileImage","ProfileImage")
                .where({
                    album_private: false
                })
                .skip(skip)
                .take(limit)
                .getMany();

            if(rows.length <= 0)
                throw new Error(`Napaka: Seznam slike je trenutno prazen !!!`)

            const grouped = rows.reduce((acc, img) => {
                let test = img.album_name ?? "Uncategorized";
                (acc[test] ||= []).push(img);
                return acc;
            }, {} as Record<string, UserImages[]>);

            return res.status(200).json(grouped);

        }catch (error: Error | any){
            return res.status(401).json({
                message: error.message
            });
        }
    }
    @Get('/user/album/by/username/:username')
    async get_album_by_username(@Param('username') username: string, @Req() req: any, @Res() res: any){
        try {

            let findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .where({
                                                        username: username
                                                      })
                                                      .getOne();
            if(!findUser)
                throw new Error(` Napaka: Za iskanega uporabnika '${username}' ni bilo mogoče najti slik ! `)

            const page = parseInt((req as any).query.page) > 0 ? parseInt((req as any).query.page) : 1;
            const limit = 20;
            const skip = (page - 1) * limit;
            const rows = await AppDataSource.manager.getRepository(UserImages)
                .createQueryBuilder("UI")
                .leftJoinAndSelect("UI.fk_user_id","User")
                .leftJoinAndSelect("User.profileImage","ProfileImage")
                .where({ fk_user_id: findUser })
                .skip(skip)
                .take(limit)
                .getMany();
           
            const grouped = rows.reduce((acc, img) => {
                let test = img.album_name ?? "Uncategorized";
                (acc[test] ||= []).push(img);
                return acc;
            }, {} as Record<string, UserImages[]>);
                                                    

           
            return res.status(200).json(grouped);

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    
    }


    @Delete('/user/album/image/delete/:album_name')
    async delete_image_by_id (@Param('album_name') album_name: string, @Req() req: Request, @Res() res: any){
        try {
     
            let findImage = await AppDataSource.manager.getRepository(UserImages)
                                                       .createQueryBuilder("UI")
                                                         .where({
                                                            album_name: album_name
                                                        })
                                                       .getMany();
                                                       
            if(findImage.length <= 0)
                throw new Error(` Napaka: Iskana slika ne obstaja !!! `)

            let deleteImage = await AppDataSource.manager.getRepository(UserImages)
                                                       .createQueryBuilder("UI")
                                                       .delete()
                                                         .from(UserImages)
                                                            .where({    
                                                                album_name: album_name
                                                            })
                                                       .execute();

            return res.status(200).json({
                message: "Slika je bila uspešno izbrisana !!!"
            })
     
        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }   
    }

    @Delete('/user/album/image/delete/id/:id')
    async delete_image_by_image_id (@Param('id') id: number, @Req() req: Request, @Res() res: any) {
        try {
            const findImage = await AppDataSource.manager.getRepository(UserImages)
                                                     .createQueryBuilder("UI")
                                                     .where({ id: id })
                                                     .getOne();

            if (!findImage)
                throw new Error(`Napaka: Izbrana slika/video ne obstaja !!!`)

            await AppDataSource.manager.getRepository(Comment)
                                        .createQueryBuilder("C")
                                        .delete()
                                        .from(Comment)
                                        .where("fk_video_id = :id", { id: id })
                                        .execute();

            await AppDataSource.manager.getRepository(UserImages)
                                        .createQueryBuilder("UI")
                                        .delete()
                                        .from(UserImages)
                                        .where({ id: id })
                                        .execute();

            return res.status(200).json({
                message: "Datoteka je bila uspešno izbrisana !!!"
            })

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Post('/user/album/image/update/type/id/:id')
    async update_image_type_by_id(@Param('id') id: number, @Body() body: any, @Req() req: Request, @Res() res: any) {
        try {
            const findImage = await AppDataSource.manager.getRepository(UserImages)
                                                     .createQueryBuilder("UI")
                                                     .where({ id: id })
                                                     .getOne();
            if (!findImage)
                throw new Error(` Napaka: Izbrana slika/video ne obstaja !!! `)

            findImage.album_private = body?.album_private === true || body?.album_private === 'true' || body?.album_private === 1 || body?.album_private === '1';
            await AppDataSource.manager.save(findImage);

            return res.status(200).json({
                message: "Status zasebnosti je bil uspešno posodobljen !!!"
            })

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Post('/user/album/image/update/type/:album_name')
    async update_album_private_public (@Param('album_name') album_name: string, @Body() body: any, @Req() req: Request, @Res() res: any){
        try{
         
            let findAlbum = await AppDataSource.manager.getRepository(UserImages)
                                                       .createQueryBuilder("UI")
                                                       .where({
                                                        album_name: album_name
                                                       })
                                                       .getMany();
            if(findAlbum.length <= 0)
                throw new Error(` Napaka: Iskan album ne obstaja !!! `)

            for(let album of findAlbum){
                album.album_private = body.album_type;
                await AppDataSource.manager.save(album);
            }

            let album_message: string = '';
            if(body.album_private === true || body.album_private === "true"){
                album_message = `Album '${album_name}' je sedaj nastavljen kot zaseben.`;
            }else {
                album_message = `Album '${album_name}' je sedaj nastavljen kot javen.`;
            }

            return res.status(200).json({
                message: album_message
            });
            
        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Post('/user/album/upload/video')
    async upload_video(@UploadedFile('video', { options: fileUploadOptions() }) file: Express.Multer.File, @Body() data: any, @Req() req: Request, @Res() res: any ) {
        try {
             if (!file) {
                 return res.status(400).json({ message: 'Video file is missing.' });
             }

             const ext = path.extname(file.originalname).toLowerCase();
             if (file.mimetype !== 'video/mp4' || ext !== '.mp4') {
                 return res.status(400).json({ message: 'Only .mp4 videos are allowed.' });
             }

           let fk_user_id: User = JSON.parse(data.fk_user_id) as User;
           let findUser = await AppDataSource.manager.getRepository(User)
                                                    .createQueryBuilder("U")
                                                    .where({
                                                        id: fk_user_id.id
                                                    })
                                                    .getOne();
                                    
            if(!findUser)
                throw new Error(`Napaka: Za iskanega uporabnika ni bilo mogoče najti podatkov !!!`);

            const albumName = data.album_name ?? `videos-${findUser.username}`;
            let filePath = path.join(process.cwd()+`/src/uploads/${findUser.username}/videos/${albumName}`);
            // Če datoteka ne obstaja jo ustvari
            if(!fs.existsSync(filePath)){
                fs.mkdirSync(filePath, { recursive: true });
            }
            
            const outputFileName = file.originalname;
            const destPath = path.join(filePath, outputFileName);
            fs.renameSync(file.path, destPath);

            let UI: UserImages = new UserImages();  
            UI.fk_user_id = findUser; 
            UI.mimeType = file.mimetype; 
            UI.path = `/uploads/${findUser.username}/videos/${albumName}/${outputFileName}`;
            UI.sizeBytes = file.size;
            UI.album_private = false;
            UI.album_name = albumName;
            await AppDataSource.manager.save(UI);        
            
            
            
            return res.status(200).json({
                message: "Video je bil uspešno naložen."
            })

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Get('/user/album/videos')
    async get_only_videos(@Req() req: Request, @Res() res: any){
        try {
            const rows = await AppDataSource.manager.getRepository(UserImages)
                                                    .createQueryBuilder("UI")
                                                    .leftJoinAndSelect("UI.fk_user_id","User")
                                                    .leftJoinAndSelect("User.profileImage","ProfileImage")
                                                    .where("UI.mimeType LIKE :mime", { mime: 'video/%' })
                                                    .andWhere("UI.album_private = :isPrivate", { isPrivate: false })
                                                    .getMany();

            if(rows.length <= 0)
                throw new Error(`Napaka: Seznam videov je trenutno prazen !!!`)

            const grouped = rows.reduce((acc, img) => {
                let test = img.album_name ?? "Uncategorized";
                (acc[test] ||= []).push(img);
                return acc;
            }, {} as Record<string, UserImages[]>);

            return res.status(200).json(grouped);

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Get('/user/album/videos/blocked')
    async get_blocked_videos(@Req() req: Request, @Res() res: any){
        try {
            const rows = await AppDataSource.manager.getRepository(UserImages)
                                                    .createQueryBuilder("UI")
                                                    .leftJoinAndSelect("UI.fk_user_id","User")
                                                    .leftJoinAndSelect("User.profileImage","ProfileImage")
                                                    .where("UI.mimeType LIKE :mime", { mime: 'video/%' })
                                                    .andWhere("UI.album_private = :isPrivate", { isPrivate: true })
                                                    .getMany();

            if(rows.length <= 0)
                throw new Error(`Napaka: Seznam blokiranih videov je trenutno prazen !!!`)

            const grouped = rows.reduce((acc, img) => {
                let test = img.album_name ?? "Uncategorized";
                (acc[test] ||= []).push(img);
                return acc;
            }, {} as Record<string, UserImages[]>);

            return res.status(200).json(grouped);

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }



}