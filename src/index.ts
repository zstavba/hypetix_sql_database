// Load environment variables from .env in development
require('dotenv').config();
// This file is CloudLinux/cPanel safe.
// It runs as a single Node.js process (no cluster, no workers, no child processes)
// to ensure minimal process usage and avoid exceeding shared hosting limits (e.g., 80 processes).
// Do not add clustering, worker_threads, or child_process usage in this file.

import { AppDataSource } from "./data-source"
import { User } from "./entity/User"
import { UserSession } from "./entity/UserSession"
import { createExpressServer } from 'routing-controllers';
import * as http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import UserController from './Controllers/UserController';
const bodyParser = require("body-parser");
const express = require("express");
import path = require('path');
import InformationController from "./Controllers/InformationController";
import AlbumController from "./Controllers/AlbumController";
import NewsController from "./Controllers/NewsController";
import MessagesController from "./Controllers/MessagesController";
import StripeController from "./Controllers/StripeController";
import LikesController from "./Controllers/LikesController";
import CommentController from "./Controllers/CommentController";
import EventsController from "./Controllers/EventsController";
import { BillingPlanController } from "./Controllers/BillingPlanController";
import { NotificationController } from "./Controllers/NotificationController";
import { GeneralServicesController } from "./Controllers/GeneralServicesController";

const PORT = process.env.PORT;

AppDataSource.initialize()
  .then(async () => {
    const app = createExpressServer({
        cors:true,
        routePrefix: '/api',
        controllers: [
          UserController,
          InformationController,
          AlbumController,
          NewsController,
          MessagesController,
          StripeController,
          LikesController,
          CommentController,
          EventsController,
          BillingPlanController,
          NotificationController,
          GeneralServicesController
        ], // we specify controllers we want to use
        currentUserChecker: async (action: any) => {
          // Get session token from headers (Authorization: Bearer <token> or custom header)
          const token = action.request.headers['authorization']?.replace('Bearer ', '') ||
                        action.request.headers['x-session-token'];

          if (!token) {
            return null;
          }

          try {
            // Find the session and get the logged-in user
            const session = await AppDataSource.getRepository(UserSession)
              .createQueryBuilder("session")
              .leftJoinAndSelect("session.fk_logged_in_user", "user")
              .where("session.session_token = :token", { token })
              .getOne();

            return session?.fk_logged_in_user || null;
          } catch (error) {
            return null;
          }
        }
    });

    app.set("trust proxy", true)

 
    // For cPanel: serve static from /uploads if needed
    const uploadsPath = path.join(process.cwd(), 'src', 'uploads');
    app.use('/uploads', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range,Content-Type,Accept');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Accept-Ranges,Content-Length');
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });
    app.use('/uploads', express.static(uploadsPath, {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store');
      }
    }));
    app.use(bodyParser.json({
      // Skip if content type is multipart/form-data
      type: (req) => {
        const contentType = req.headers['content-type'] || '';
        return !contentType.includes('multipart/form-data');
      }
    }));
    app.use('/uploads', express.static(path.join(process.cwd(), 'src/uploads'), {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store');
      }
    }));

    // Attach Socket.IO to the HTTP server
    const server = http.createServer(app);
    const io = new SocketIOServer(server, {
      path: '/socket.io',
      cors: {
        origin: '*', // Allow all origins, or specify your frontend URL
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    // Make io available globally
    const { setIO } = require('./socket');
    setIO(io);

    io.on('connection', (socket) => {
      // Only log in non-production environments
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev) console.log('Socket.IO client connected:', socket.id);
      // Register user to a room for targeted events
      socket.on('register-user', (userId) => {
        if (userId) {
          socket.join(`user:${userId}`);
          if (isDev) {
            console.log(`[Socket.IO] Socket ${socket.id} joined room user:${userId}`);
            // List all rooms for this socket
            console.log(`[Socket.IO] Rooms for socket ${socket.id}:`, Array.from(socket.rooms));
          }
          // Emit confirmation event back to client
          socket.emit('register-user-confirmed', { userId, status: 'ok' });
        } else {
          socket.emit('register-user-confirmed', { userId, status: 'error', message: 'Invalid userId' });
        }
      });
      // Listen for user-update events and emit to both sender and recipient
      socket.on('user-update', (data) => {
        if (isDev) console.log('[Socket.IO] Received user-update event:', data);
        if (data.fromUserId) {
          io.to(`user:${data.fromUserId}`).emit('user-update', data);
          if (isDev) console.log(`[Socket.IO] Emitted user-update to sender room user:${data.fromUserId}`, data);
        }
        if (data.toUserId) {
          io.to(`user:${data.toUserId}`).emit('user-update', data);
          if (isDev) console.log(`[Socket.IO] Emitted user-update to recipient room user:${data.toUserId}`, data);
        }
        // Emit confirmation event back to client
        socket.emit('user-update-confirmed', { status: 'ok', data });
        if (isDev) {
          // List all rooms and sockets for debug
          console.log(`[Socket.IO] All rooms:`, Array.from(io.sockets.adapter.rooms.keys()));
        }
      });
      socket.on('disconnect', () => {
        if (isDev) console.log('Socket.IO client disconnected:', socket.id);
      });
    });

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
