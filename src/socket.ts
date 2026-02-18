import { Server as SocketIOServer } from 'socket.io';
let io: SocketIOServer;

export function setIO(serverInstance: SocketIOServer) {
  io = serverInstance;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io instance not set!');
  return io;
}
