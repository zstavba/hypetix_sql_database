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
import { NewsCategory } from '../entity/NewsCategory';
import { News } from '../entity/News';
import { NewsBlocked } from '../entity/NewsBlocked';
import { Comment } from '../entity/Comment';
import { ManyToMany } from 'typeorm';

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
    if (file.mimetype?.startsWith('image/')) cb(null, true);
    else cb(null, false); // Use null for error, false for rejection
  },
});

const upload = multer(fileUploadOptions());

@JsonController()
export default class NewsController {

    @Post('/news/create/category')
    async create_category( @Body() data: any, @Req() req: Request, @Res() res: any){
        try {

            let NC: NewsCategory = new NewsCategory();
            NC.fk_user_id = data.fk_user_id;
            NC.name = data.name; 

            await AppDataSource.manager.save(NC);

            if (!res.headersSent) {
              return res.status(200).json({
                message: "Podatki za kategorijo so bili uspešno ustvarjeni !!!"
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

    @Delete('/news/delete/category/:id')
    async delete_category (@Param('id') id: string, @Req() req: Request, @Res() res: any) {
      try {

        let findCategory = await AppDataSource.manager.getRepository(NewsCategory)
                                                  .createQueryBuilder("NC")
                                                  .where({
                                                    id: id
                                                  })
                                                  .getOne();

        if(!findCategory)
          throw new Error(`Napaka: Izbrana kategorija, ki jo želite izbrisati ne obstaja !!!`)

        let deleteCategory = await AppDataSource.manager.getRepository(NewsCategory)
                                                    .createQueryBuilder("NC")
                                                    .delete()
                                                    .from(NewsCategory)
                                                    .where({
                                                      id: id
                                                    })
                                                    .execute(); 

        return res.status(200).json({
          message: "Kategorija je bila uspešno izbrisana !!!"
        });

      } catch (error: Error | any) {
        return res.status(401).json({
          message: error.message
        });
      }
    }

    @Post('/news/category/update/:id')
    async update_category (@Param('id') id: string, @Body() data: any, @Req() req: Request, @Res() res: any) {
      try {

        let findCategory = await AppDataSource.manager.getRepository(NewsCategory)
                                                  .createQueryBuilder("NC")
                                                  .where({
                                                    id: id
                                                  })
                                                  .getOne();
                                                
        if(!findCategory)
          throw new Error(`Napaka: Izbrana kategorija, ki jo želite posodobiti ne obstaja !!!`)

        await AppDataSource.manager.getRepository(NewsCategory)
                                  .createQueryBuilder("NC")
                                  .update(NewsCategory)
                                  .set({
                                    name: data.name
                                  })
                                  .where({
                                    id: id
                                  })
                                  .execute();

        return res.status(200).json({
          message: "Kategorija je bila uspešno posodobljena !!!"
        });

      }
      catch (error: Error | any) {
        return res.status(401).json({
          message: error.message
        });
      }
    }

    @Get('/news/get/category')
    async get_categories (@Req() req: Request, @Res() res: any) {
        try {
          const rows = await AppDataSource.getRepository(NewsCategory)
                                          .createQueryBuilder("NC")
                                          .leftJoinAndSelect("NC.fk_user_id","User")
                                          .leftJoinAndSelect("NC.news", "News", "News.blocked = :blocked", { blocked: false })                                          
                                          .skip(0)
                                          .take(20)
                                          .getMany();

            return res.status(200).json(rows);

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Post('/news/create/item')
    async create_news_item ( @Body() data: any, @Req() req: Request, @Res() res: any){
        try {

            let fk_category_id: NewsCategory = data.fk_category_id as NewsCategory;
            let NI: News = new News();
            NI.country = data.country; 
            NI.description = data.description;
            NI.fk_user_id = data.fk_user_id as User;
            NI.fk_category_id =fk_category_id;
            NI.region = data.state; 
            NI.title = data.title;
            NI.zip_code = data.zip_code; 
            NI.fk_album_id = data.fk_album_id  as UserImages;
            NI.categories = [fk_category_id];
            await AppDataSource.manager.save(NI);

            return res.status(200).json({
                message: "Novica je bila uspešno ustvarjena !!!"
            })

        }catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

    @Get('/news/get/news/:username')
    async getUserNewsbyusername (@Param('username') username: string, @Req() req: any, @Res() res: any ) {

      try {

        let findUser = await AppDataSource.manager.getRepository(User)
                                                  .createQueryBuilder("U")
                                                  .where({
                                                    username: username
                                                  })
                                                  .getOne();
                                                
        if(!findUser)
          throw new Error(`Napaka: Iskan uporabnik ne obstaja !!!`);

        const page = parseInt((req as any).query.page) > 0 ? parseInt((req as any).query.page) : 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        let [findNews, total] = await AppDataSource.manager.getRepository(News)
          .createQueryBuilder("N")
          .leftJoinAndSelect("N.fk_user_id","User")
          .leftJoinAndSelect("User.profileImage","ProfileImage")
          .leftJoinAndSelect('N.fk_album_id',"UserImages")
          .leftJoinAndSelect('N.fk_category_id',"NewsCategory")
          .where({
            fk_user_id: findUser
          })
          .skip(skip)
          .take(limit)
          .skip(skip)
          .take(limit)
          .getManyAndCount();
                                      
      if(findNews.length <= 0)
        throw new Error(`Napaka: Tvoj seznam oglasov je prazen.`)

      return res.status(200).json(findNews);

      } catch (error: Error | any)  {
        return res.status(401).json({
          message: error.message
        });
      }

    }

    @Get("/news/get/by/category/:category")
    async getNewsbyCategory (@Param('category') category: string, @Req() reqq: Request, @Res() res: any) {
      try {

        let findCategory = await AppDataSource.manager.getRepository(NewsCategory)
                                                     .createQueryBuilder("NC")
                                                     .where({
                                                      name: category
                                                     })
                                                     .getOne();
                                                

      if(!findCategory)
        throw new Error(`Napaka: Izbrana kategorija ne obstaja !!!`);
      
        let findNews = await AppDataSource.manager.getRepository(News)
                                                  .createQueryBuilder("N")
                                                  .leftJoinAndSelect("N.fk_user_id","User")
                                                  .leftJoinAndSelect("User.profileImage","ProfileImage")
                                                  .leftJoinAndSelect('N.fk_album_id',"UserImages")
                                                  .leftJoinAndSelect('N.fk_category_id',"NewsCategory")
                                                  .where({
                                                    fk_category_id: findCategory,
                                                    blocked: false
                                                  })
                                                  .skip(0)
                                                  .take(20)
                                                  .getMany();

        return res.status(200).json(findNews);

      } catch (error: Error | any) {
        return res.status(401).json({
          message: error.message
        });
      }

    }

    @Delete('/news/delete/:id')
    async deleteNewsByID (@Param('id') id: string, @Req() req: Request, @Res() res: any) {
      try {

        let findNews = await AppDataSource.manager.getRepository(News)
                                                  .createQueryBuilder("N")
                                                  .where({
                                                    id: id
                                                  })
                                                  .getOne();
                                            
        if(!findNews)
          throw new Error(`Napaka: Izbrana novica, ki jo želite izbrisati ne obstaja !!!`)

        // Remove dependent records to satisfy FK constraints
        await AppDataSource.manager.getRepository(Comment)
                                  .createQueryBuilder('C')
                                  .delete()
                                  .from(Comment)
                                  .where('fk_news_id = :id', { id })
                                  .execute();

        await AppDataSource.manager.getRepository(NewsBlocked)
                                  .createQueryBuilder('NB')
                                  .delete()
                                  .from(NewsBlocked)
                                  .where('fk_news_id = :id', { id })
                                  .execute();

        let deleteNews = await AppDataSource.manager.getRepository(News)
                                                    .createQueryBuilder("N")
                                                    .delete()
                                                    .from(News)
                                                    .where({
                                                      id: id 
                                                    })
                                                    .execute();

        return res.status(200).json({
          message: "Novica je bila uspešno izbrisana !!!"
        });
      } catch (error: Error | any) {
        return res.status(401).json({
          message: error.message
        });
      }

    }

    @Post('/news/block')
    async blockSelectedNews (@Body() data: any, @Req() req: Request, @Res() res: any){
      try {

        let findUser = await AppDataSource.manager.getRepository(User)
                                                  .createQueryBuilder("U")
                                                  .where({
                                                    id: data.fk_user_id.id
                                                  })
                                                  .getOne();

        if(!findUser)
          throw new Error(`Napaka: Za izbrano novico iskani  uporabnik ne obstaja !!!`);

        let findNews = await AppDataSource.manager.getRepository(News)
                                                  .createQueryBuilder("N")
                                                  .where({
                                                    id: data.fk_news_id
                                                  })
                                                  .getOne();
                                              
        if(!findNews)
          throw new Error(`Napaka: Iskana novica ne obstaja  !!!`);


        findNews.blocked = true;

        await AppDataSource.manager.save(findNews);


        let BlockeNews: NewsBlocked = new NewsBlocked();
        BlockeNews.fk_news_id = findNews;
        BlockeNews.fk_user_id = findUser;

        await AppDataSource.manager.save(BlockeNews);


        return res.status(200).json({
          message: "Izbrana novica je bila uspešno izbrisana !!!"
        });

      } catch (error: Error | any){
        return res.status(401).json({
          message: error.message
        });
      }
    }

    @Get('/news/get/blocked')
    async get_blocked_news (@Req() req: Request, @Res() res: any) {
      try {

        let findBlockedNews = await AppDataSource.manager.getRepository(News)
                                                         .createQueryBuilder("N")
                                                         .leftJoinAndSelect("N.fk_user_id","User")
                                                         .leftJoinAndSelect("User.profileImage","ProfileImage")
                                                         .leftJoinAndSelect("N.fk_album_id","UserImages")
                                                         .where({
                                                          blocked: true
                                                         })
                                                         .getMany();

      
      return res.status(200).json(findBlockedNews);

      } catch (error: Error | any) {
        return res.status(401).json({
          message: error.message
        });
      }
    }


    @Get('/news/unblock/:id')
    async unblock_selected_news (@Param('id') id: string, @Req() req: Request, @Res() res: any) {
      try {

        let findNews = await AppDataSource.manager.getRepository(News)
                                                  .createQueryBuilder("N")
                                                  .where({
                                                    id: id
                                                  })
                                                  .getOne();
        
        if(!findNews)
          throw new Error(`Napaka: Izbrana novica pod IDjem: '${id}'  ne obstaja !!!`)

        findNews.blocked = false; 

        await AppDataSource.manager.save(findNews);

        let deleteNews = await AppDataSource.manager.getRepository(News)
                                                    .createQueryBuilder("N")
                                                    .delete()
                                                    .from(NewsBlocked)
                                                    .where({
                                                      fk_news_id: id
                                                    })
                                                    .execute();

        return res.status(200).json({
          message: "Novica je bila uspešno odblokirana !!!"
        })

      } catch (error: Error | any){
        return res.status(401).json({
          message: error.message
        });
      }
    }
}