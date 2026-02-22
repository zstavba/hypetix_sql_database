import { userInfo } from 'os';
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
import type * as Express from 'express';

import { UserFavorites } from '../entity/UserFavorites';
import { NewsCategory } from '../entity/NewsCategory';
import { News } from '../entity/News';
import { NewsBlocked } from '../entity/NewsBlocked';
import { Brackets, FindCursor, In, IsNull, ManyToMany, Not, SubjectWithoutIdentifierError } from 'typeorm';
import { Conversation } from '../entity/Conversation';
import { ConversationParticipant } from '../entity/ConversationParticipant ';
import { Message } from '../entity/Message';
import { get } from 'http';

const allowed = [
  'image/jpeg','image/png','image/webp','image/gif',
  'image/avif','image/svg+xml','image/heic','image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed'
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
export default class MessagesController {

  private async getUserFromToken(req: Request): Promise<User | null> {
    const token = req.headers['x-session-token'] as string;
    if (!token) return null;

    const session = await AppDataSource.getRepository(UserSession)
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.fk_logged_in_user', 'user')
      .where('s.session_token = :token', { token })
      .getOne();

    return session?.fk_logged_in_user || null;
  }

  @Post('/message/send')
  async sendMessage(
    @UploadedFiles('files', { options: fileUploadOptions() }) files: any[],
    @Body() data: any,
    @Res() response: any,
    @Req() req: Request,
  ){

    try {
      // Always use session token for user identification
      const userFromToken = await this.getUserFromToken(req);
      if (!userFromToken) {
        if (!response.headersSent) {
          return response.status(401).json({message: "Uporabnik ni avtenticiran (ni veljavne seje)!"});
        }
      }

      let recipents = data.recipents ? JSON.parse(data.recipents) : [];
      const title = data.title as string;
      const body = data.body as string;
      const userRepository = AppDataSource.getRepository(User);

      // Normalize recipients: support [9], [{id:9}], or mixed
      recipents = recipents.map((r: any) => (typeof r === 'object' && r !== null && 'id' in r) ? r : { id: Number(r) });

      if (recipents.length === 0) {
        if (!response.headersSent) {
          return response.status(400).json({message: "Preden želite poslati sporočilo morate najprej izbrati vsaj enega prejemnika!!!"});
        }
      }

      // Always add the creator as a participant
      const converstion = await AppDataSource.getRepository(Conversation).save({
        fk_user_id: { id: userFromToken.id } as User,
        isGroup: recipents.length > 1,
        title: title || null,
      });

      // Add creator as participant if not already in recipients
      let creatorCP: ConversationParticipant = new ConversationParticipant();
      creatorCP.user = userFromToken;
      creatorCP.conversation = converstion;
      creatorCP.invitedBy = userFromToken;
      await AppDataSource.getRepository(ConversationParticipant).save(creatorCP);

      // Add all recipients as participants (skip if same as creator)
      for(const recipent of recipents) {
        const user = await userRepository.findOneBy({id: recipent.id});
        if(user && user.id !== userFromToken.id) {
          let CP: ConversationParticipant = new ConversationParticipant();
          CP.user = user;
          CP.conversation = converstion;
          CP.invitedBy = userFromToken;
          await AppDataSource.getRepository(ConversationParticipant).save(CP);
        }
      }

      let message: Message = new Message();
      message.conversation = converstion;
      message.sender = { id: userFromToken.id } as User;
      message.body = body;

      let filePath = path.join(process.cwd(), 'uploads', 'profiles', `conversation_${converstion.id}`);
      // Če datoteka ne obstaja jo ustvari
      if(!fs.existsSync(filePath)){
        fs.mkdirSync(filePath, { recursive: true });
      }

      for(const file of files){
        // file.path is where multer put it (process.cwd()/uploads/filename)
        const destPath = path.join(filePath, file.originalname);
        fs.renameSync(file.path, destPath);

        let userImage: UserImages = new UserImages();
        // Use correct property for relation to User entity
        userImage.fk_user_id = userFromToken;
        userImage.album_name = `conversation_${converstion.id}`;
        userImage.album_private = true;
        userImage.path = `/uploads/profiles/conversation_${converstion.id}/${file.originalname}`;
        userImage.mimeType = file.mimetype;
        userImage.sizeBytes = file.size;
        await AppDataSource.getRepository(UserImages).save(userImage);

        message.attachments = [...(message.attachments || []), {
          type: file.mimetype || 'application/octet-stream',
          url: userImage.path,
          name: file.originalname,
          size: file.size
        }];
      }




      await AppDataSource.getRepository(Message).save(message);

      // --- SOCKET.IO: Notify recipient(s) to open messenger popout ---
      try {
        // Get Socket.IO instance from global (set in index.ts)
        const io = require('../socket').getIO?.();
        if (io && recipents.length > 0) {
          for (const recipent of recipents) {
            // If recipent is an object with id, use recipent.id, else use recipent
            const recipentId = typeof recipent === 'object' && recipent !== null && 'id' in recipent ? Number(recipent.id) : Number(recipent);
            io.to(`user:${recipentId}`).emit('user-update', {
              type: 'open-messenger-popout',
              conversationId: converstion.id,
              fromUserId: Number(userFromToken.id),
              toUserId: recipentId,
              showPopout: true
            });
            console.log(`[Socket.IO] Messenger popout event emitted to recipient user:${recipentId} for conversation ${converstion.id}`);
            // Also emit to sender (creator) for their own popout
            io.to(`user:${userFromToken.id}`).emit('user-update', {
              type: 'open-messenger-popout',
              conversationId: converstion.id,
              fromUserId: Number(userFromToken.id),
              toUserId: recipentId,
              showPopout: true
            });
            console.log(`[Socket.IO] Messenger popout event emitted to sender user:${userFromToken.id} for conversation ${converstion.id}`);
          }
        }
      } catch (e) {
        console.error('Socket.IO emit error (new conversation):', e);
      }

      // Return the new conversation's ID so the frontend can use it
      return response.status(200).json({
        message: "Spšoročilo uspešno poslano!",
        conversationId: converstion.id
      });

    } catch (error: any) {
      return response.status(500).json({message:  error.message});
    }


  }


  @Get('/message/get/conversations/:fk_user_id')
  async getMessages(
    @Param('fk_user_id') fk_user_id: number,
    @Req() req: Request,
    @Res() response: any,
  ){
    try {
      // Fix: Use req as any to access query property
      const page = parseInt((req as any).query?.page) > 0 ? parseInt((req as any).query.page) : 1;
      const limit = 20;
      const skip = (page - 1) * limit;
      const [converstions, total] = await AppDataSource.manager.getRepository(Conversation)
        .createQueryBuilder("conversation")
        .leftJoinAndSelect("conversation.fk_user_id", "fk_user")
        .leftJoinAndSelect("fk_user.profileImage", "fk_user_profileImage")
        .leftJoinAndSelect("conversation.participants", "participants")
        .leftJoinAndSelect("participants.user", "user")
        .leftJoinAndSelect("user.profileImage", "user_profileImage")
        .where(new Brackets((qb) => {
          qb.where("conversation.fk_user_id = :fk_user_id", { fk_user_id })
            .orWhere("participants.user.id = :fk_user_id", { fk_user_id });
        }))
        .andWhere("conversation.isDeleted = :isDeleted", { isDeleted: false })
        .andWhere("conversation.isBlocked = :isBlocked", { isBlocked: false })
        .orderBy("conversation.updatedAt", "DESC")
        .distinct(true)
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return response.status(200).json({
        conversations: converstions,
        page,
        pageSize: limit,
        total
      });

    } catch (error: any) {
      return response.status(500).json({message:  error.message});
    }

  }

  @Get('/message/blocked/conversations/:fk_user_id')    
  async getBlockedMessages(
    @Param('fk_user_id') fk_user_id: number,
    @Req() req: Request,
    @Res() response: any,
  ){
    try {
      const blockedConversations = await AppDataSource.manager.getRepository(Conversation)
                                                      .createQueryBuilder("conversation")
                                                      .leftJoinAndSelect("conversation.fk_user_id", "fk_user")
                                                      .leftJoinAndSelect("fk_user.profileImage", "fk_user_profileImage")
                                                      .leftJoinAndSelect("conversation.participants", "participants")
                                                      .leftJoinAndSelect("participants.user", "user")
                                                      .leftJoinAndSelect("user.profileImage", "user_profileImage")
                                                      .where(new Brackets((qb) => {
                                                        qb.where("conversation.fk_user_id = :fk_user_id", { fk_user_id })
                                                          .orWhere("participants.user.id = :fk_user_id", { fk_user_id });
                                                      }))
                                                      .andWhere("conversation.isDeleted = :isDeleted", { isDeleted: false })
                                                      .andWhere("conversation.isBlocked = :isBlocked", { isBlocked: true })
                                                      .orderBy("conversation.updatedAt", "DESC")
                                                      .distinct(true)
                                                      .getMany();

      return response.status(200).json(blockedConversations);

    } catch (error: any) {
      return response.status(500).json({message:  error.message});
    }
  }



  @Delete('/message/delete/conversation/:conversation_id')
  async deleteConversation(
    @Param('conversation_id') conversation_id: number,
    @Req() req: Request,
    @Res() response: any,
  ){
    try {

      const findConversation = await AppDataSource.getRepository(Conversation).findOneBy({id: conversation_id});

      if(!findConversation) {
        console.warn(`[deleteConversation] Conversation not found for id:`, conversation_id);
        return  response.status(404).json({message: `Izbrano sporočilo (ID: ${conversation_id}) ni bilo najdeno!`});
      }


      await AppDataSource.getRepository(Conversation).softDelete(conversation_id);


      return response.status(200).json({message: "Sporočilo je bilo uspešno izbrisano !!"});

    } catch (error: any) {
      return response.status(500).json({message:  error.message});
    }
  }

  @Get('/message/get/deleted/messages/:fk_user_id')
  async getDeletedMessages(
    @Param('fk_user_id') fk_user_id: number,
    @Req() req: Request,
    @Res() response: any,
  ){
    try {
      const deletedConverstions = await AppDataSource.manager.getRepository(Conversation)
                                                      .createQueryBuilder("conversation")
                                                      .leftJoinAndSelect("conversation.fk_user_id", "fk_user")
                                                      .leftJoinAndSelect("fk_user.profileImage", "fk_user_profileImage")
                                                      .leftJoinAndSelect("conversation.participants", "participants")
                                                      .leftJoinAndSelect("participants.user", "user")
                                                      .leftJoinAndSelect("user.profileImage", "user_profileImage")
                                                      .where("conversation.fk_user_id = :fk_user_id", { fk_user_id })
                                                      .andWhere("conversation.isDeleted = :isDeleted", { isDeleted: true })
                                                      .orderBy("conversation.updatedAt", "DESC")
                                                      .getMany();


      return response.status(200).json(deletedConverstions);

    } catch (error: any) {
      return response.status(500).json({message:  error.message});
    }
  }

  @Get('/message/undelete/conversation/:conversation_id')
  async undeleteConversation(
    @Param('conversation_id') conversation_id: number,
    @Req() req: Request,
    @Res() response: any,
  ){
    try {

      const findConversation = await AppDataSource.getRepository(Conversation).findOneBy({id: conversation_id});

      if(!findConversation) {
        console.warn(`[undeleteConversation] Conversation not found for id:`, conversation_id);
        return  response.status(404).json({message: `Izbrano sporočilo (ID: ${conversation_id}) ni bilo najdeno!`});
      }
      findConversation.isBlocked = false;
      await AppDataSource.getRepository(Conversation).save(findConversation);


      return response.status(200).json({message: "Sporočilo je bilo uspešno obnovljeno !!"});

    } catch (error: any) {
      return response.status(500).json({message:  error.message});
    }
  }

  @Get('/message/get/messages/:conversation_id')
  async getConversationMessages(
    @Param('conversation_id') conversation_id: number,
    @Req() req: Request,
    @Res() response: any,
  ){

    try {

      let findConversationMessages = await AppDataSource.getRepository(Message)
                                                        .createQueryBuilder("message")
                                                        .leftJoinAndSelect("message.conversation", "conversation")
                                                        .leftJoinAndSelect("message.sender", "sender")
                                                        .leftJoinAndSelect("sender.profileImage", "sender_profileImage")
                                                        .where("conversation.id = :conversation_id", { conversation_id })
                                                        .andWhere("message.deletedAt IS NULL")
                                                        .orderBy("message.createdAt", "ASC")
                                                        .getMany();



      return response.status(200).json(findConversationMessages);

    } catch (error: any) {
      return response.status(500).json({message:  error.message});
    }


  }

  @Delete('/message/delete/:message_id')
  async deleteMessage(
    @Param('message_id') message_id: string,
    @Req() req: Request,
    @Res() response: any,
  ) {
    try {
      const messageRepo = AppDataSource.getRepository(Message);
      const message = await messageRepo.findOne({ where: { id: message_id } });

      if (!message) {
        return response.status(404).json({ message: 'Sporočilo ni bilo najdeno.' });
      }

      message.deletedAt = new Date();
      await messageRepo.save(message);

      return response.status(200).json({ message: 'Sporočilo je bilo izbrisano.' });
    } catch (error: any) {
      return response.status(500).json({ message: error.message });
    }
  }

  @Post('/message/send/text/:conversation_id')
  async sendTextMessage(
    @UploadedFiles('files', { options: fileUploadOptions() }) files: any[],
    @Param('conversation_id') conversation_id: number,
    @Body() data: any,
    @Res() response: any,
    @Req() req: Request,
  ){
    try {

      if(!data.fk_user_id)
        return response.status(401).json({message: "Uporanik ni avtenticiran!"});

      let findConversation = await AppDataSource.getRepository(Conversation).findOneBy({id: conversation_id});

      if(!findConversation) {
        console.warn(`[sendTextMessage] Conversation not found for id:`, conversation_id);
        return response.status(404).json({message: `Izbrano sporočilo (ID: ${conversation_id}) ni bilo najdeno!`});
      }

      console.log(data);


      let parsedUser = null;
      let senderIdForSocket = undefined;
      try {
        parsedUser = JSON.parse(data.fk_user_id);
        if (typeof parsedUser === 'number') {
          senderIdForSocket = parsedUser;
        } else if (parsedUser && typeof parsedUser === 'object' && parsedUser.id) {
          senderIdForSocket = parsedUser.id;
        }
      } catch (e) {
        // If parsing fails, maybe it's just a plain number string
        if (!isNaN(Number(data.fk_user_id))) {
          senderIdForSocket = Number(data.fk_user_id);
          parsedUser = senderIdForSocket;
        } else {
          console.error('[sendTextMessage] Failed to parse data.fk_user_id:', data.fk_user_id, e);
        }
      }
      console.log('[sendTextMessage] parsedUser:', parsedUser, 'senderIdForSocket:', senderIdForSocket);

      let message: Message = new Message();
      message.conversation = findConversation;
      message.sender = parsedUser as User;
      message.body = data.body;

      let filePath = path.join(process.cwd()+`/src/uploads/profiles/conversation_${findConversation.id}/`);
      // Če datoteka ne obstaja jo ustvari
      if(!fs.existsSync(filePath)){
        fs.mkdirSync(filePath, { recursive: true });
      }


      if(files && files.length > 0){
        for(const file of files){

          const destPath = path.join(filePath,file.originalname);
          fs.renameSync(file.path, destPath);

          let userImage: UserImages = new UserImages();
          userImage.fk_user_id = JSON.parse(data.fk_user_id) as User;
          userImage.album_name = `conversation_${findConversation.id}`;
          userImage.album_private = true;
          userImage.path = `/uploads/profiles/conversation_${findConversation.id}/${file.originalname}`;
          userImage.mimeType = file.mimetype;
          userImage.sizeBytes = file.size;
          await AppDataSource.getRepository(UserImages).save(userImage);

          message.attachments = [...(message.attachments || []), {
            type: file.mimetype || 'application/octet-stream',
            url: userImage.path,
            name: file.originalname,
            size: file.size
          }];

        }
    }




      await AppDataSource.getRepository(Message).save(message);

      // --- SOCKET.IO: Emit popout event to all participants and sender, same as sendMessage ---
      try {
        const io = require('../socket').getIO?.();
        if (io && findConversation) {
          // Get all participants
          const participants = await AppDataSource.getRepository(require('../entity/ConversationParticipant ').ConversationParticipant).find({
            where: { conversation: { id: findConversation.id } },
            relations: ['user']
          });
          // Build recipients array as in sendMessage
          const recipents = participants.map(p => p.user && p.user.id ? { id: p.user.id } : null).filter(Boolean);
          for (const recipent of recipents) {
            const recipentId = typeof recipent === 'object' && recipent !== null && 'id' in recipent ? Number(recipent.id) : Number(recipent);
            io.to(`user:${recipentId}`).emit('user-update', {
              type: 'open-messenger-popout',
              conversationId: findConversation.id,
              fromUserId: senderIdForSocket,
              toUserId: recipentId,
              showPopout: true
            });
            console.log(`[Socket.IO] Messenger popout event emitted to recipient user:${recipentId} for conversation ${findConversation.id}`);
            // Also emit to sender for their own popout for this recipient
            io.to(`user:${senderIdForSocket}`).emit('user-update', {
              type: 'open-messenger-popout',
              conversationId: findConversation.id,
              fromUserId: senderIdForSocket,
              toUserId: recipentId,
              showPopout: true
            });
            console.log(`[Socket.IO] Messenger popout event emitted to sender user:${senderIdForSocket} for conversation ${findConversation.id}`);
          }
        }
      } catch (e) {
        console.error('Socket.IO emit error (new-message/user-update):', e);
      }

      return response.status(200).json({message: "Sporočilo uspešno poslano!"});

    }
    catch (error: any) {
      return response.status(500).json({message:  error.message});
    }

  }

  @Post('/message/block/conversation/:conversation_id')
  async blockConversation(
    @Param('conversation_id') conversation_id: number,
    @Res() response: any,
    @Req() req: Request,
  ){
    try {

      let findConversation = await AppDataSource.getRepository(Conversation).findOneBy({id: conversation_id});

      if(!findConversation) {
        console.warn(`[blockConversation] Conversation not found for id:`, conversation_id);
        return  response.status(404).json({message: `Izbrano sporočilo (ID: ${conversation_id}) ni bilo najdeno!`});
      }

      findConversation.isBlocked = true;
      await AppDataSource.getRepository(Conversation).save(findConversation);

      return response.status(200).json({message: "Sporočila so bila uspešno blokirana !!"});

    } catch (error: any) {
      return response.status(500).json({message:  error.message});
    }
  }

    @Get('/message/get/participants/:conversation_id')
  async getParticipantsByConversationId(
    @Param('conversation_id') conversation_id: number,
    @Res() response: any
  ) {
    try {
      const participants = await AppDataSource.getRepository(ConversationParticipant)
        .createQueryBuilder('cp')
        .leftJoinAndSelect('cp.user', 'user')
        .leftJoinAndSelect('user.profileImage', 'profileImage')
        .where('cp.conversation = :conversation_id', { conversation_id })
        .getMany();

      // Return just the user objects, including profileImage
      const users = participants.map(cp => cp.user);
      return response.status(200).json(users);
    } catch (error: any) {
      return response.status(500).json({ message: error.message });
    }
  }

  // Get conversation between two users
  @Get('/message/get/conversation-between/:user1_id/:user2_id')
  async getConversationBetween(
    @Param('user1_id') user1_id: number,
    @Param('user2_id') user2_id: number,
    @Req() req: Request,
    @Res() response: any,
  ) {
    try {
      // Find a conversation where both users are participants and it's not deleted or blocked
      const subQuery = AppDataSource.manager.getRepository(Conversation)
        .createQueryBuilder('c')
        .select('c.id')
        .leftJoin('c.participants', 'p')
        .where('c.isDeleted = 0')
        .andWhere('c.isBlocked = 0')
        .andWhere('c.isGroup = 0')
        .andWhere('c.deletedAt IS NULL')
        .andWhere('(p.user.id = :user1_id OR p.user.id = :user2_id)', { user1_id, user2_id })
        .groupBy('c.id')
        .having('COUNT(DISTINCT p.user.id) = 2')
        .getQuery();

      const conversation = await AppDataSource.manager.getRepository(Conversation)
        .createQueryBuilder('conversation')
        .leftJoinAndSelect('conversation.participants', 'participants')
        .leftJoinAndSelect('participants.user', 'user')
        .where(`conversation.id IN (${subQuery})`)
        .andWhere('conversation.deletedAt IS NULL')
        .setParameters({ user1_id, user2_id })
        .getOne();

      if (!conversation) {
        return response.status(404).json({ message: 'No conversation found between these users.' });
      }

      // Fetch messages with full sender user object and profileImage
      const messages = await AppDataSource.manager.getRepository(Message)
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .leftJoinAndSelect('sender.profileImage', 'profileImage')
        .where('message.conversation = :conversationId', { conversationId: conversation.id })
        .orderBy('message.createdAt', 'ASC')
        .getMany();

      return response.status(200).json({ conversation, messages });
    } catch (error: any) {
      return response.status(500).json({ message: error.message });
    }
  }

  /* Import it in here  */
  

}