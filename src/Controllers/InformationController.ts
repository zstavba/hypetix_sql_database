import { AppDataSource } from './../data-source';
import { Request, NextFunction } from 'express';
import { JsonController, Post, Body, Req, Res, Get, Delete, UseBefore, UploadedFile, Param, createExpressServer } from 'routing-controllers';
import { User } from '../entity/User';
import * as bcyrpt from 'bcryptjs';
import { UserSession } from '../entity/UserSession';
import * as crypto from "crypto";
import multer, { Options } from 'multer';
import path = require('path');
import * as fs from 'fs';
import { UserImages } from '../entity/UserImages';
import { UserFavorites } from '../entity/UserFavorites';
import { UserInformation } from '../entity/UserInformation';

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

export enum FavoriteStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  CANCELED = "canceled",
}


@JsonController()
export default class InformationController {

    @Get("/user/info/get/:username")
    async getInformation (@Param('username') username: string, @Req() req: Request, @Res() res: any) {
        try {

            let findUser = await AppDataSource.manager.getRepository(User)
                                                      .createQueryBuilder("U")
                                                      .where({
                                                        username: username
                                                      })
                                                      .getOne();
                                                    
            if(!findUser)
                throw new Error(`Napaka: Iskan uporabnik pod imenom: ${username} ni  bil najden !!!`)

            let findInformation = await AppDataSource.manager.getRepository(UserInformation)
                                                              .createQueryBuilder("UI") 
                                                              .where({
                                                                fk_user_id: findUser
                                                              })
                                                              .getOne();
                                                  
            if(!findInformation)
              throw new Error(`Napaka: Iskan uporabnik '${username}'  ni še vnesel želenih podatkov !`)

            if (!res.headersSent) {
              return res.status(200).json(findInformation);
            }
                                                                                              

        } catch (error: Error | any) {
          if (!res.headersSent) {
            return res.status(401).json({
              message: error.message
            });
          }
        }


    }
    @Post("/user/info/create")
    async createInformation (@Body() data: any, @Req() req: Request, @Res() res: any) {
        try {
          const user = data.fk_user_id as User;

          let UI = await AppDataSource.manager.getRepository(UserInformation)
            .createQueryBuilder("UI")
            .where({ fk_user_id: user })
            .getOne();

          if (!UI) {
            UI = new UserInformation();
            UI.fk_user_id = user;
          }

          UI.body_type = data.body_type;
          UI.description = data.description;
          UI.height = data.height;
          UI.looking_for = data.looking_for;
          UI.meet_at = data.meet_at;
          UI.relationship_status = data.relationship_status;
          UI.relationship_partner = data.relationship_partner;
          UI.sex_type = data.sex_gender_type;
          UI.user_gay_type = data.user_Type;
          UI.user_type = data.sex_type;
          UI.weight = data.weight;

          await AppDataSource.manager.save(UI);

          return res.status(200).json({
             message: "Podatki za izbranega uporabnika so bili uspešno posodoboljeni !!!"
          })

        } catch (error: Error | any) {
            return res.status(401).json({
                message: error.message
            });
        }
    }

}