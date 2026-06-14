import 'dotenv/config';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import * as crypto from 'crypto';

process.on('uncaughtException', (err) => {
  console.error('FATAL uncaughtException:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL unhandledRejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const dev = !process.argv.includes('--production');

let cachedSecret: string | null = null;
function getSecret(): string {
  if (!cachedSecret) {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      throw new Error('SESSION_SECRET environment variable is required');
    }
    cachedSecret = secret;
  }
  return cachedSecret;
}

function verifySessionToken(token: string): { userId: string; name: string; role: string } | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = crypto.createHash('sha256').update(getSecret()).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}
const hostname = '0.0.0.0';
const rawPort = process.env.PORT || '3000';
const parsedPort = parseInt(rawPort, 10);
const port = Number.isNaN(parsedPort) ? 3000 : parsedPort;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface RoomState {
  currentSpeaker: string | null;
  speakerName: string | null;
}

const roomStates = new Map<string, RoomState>();

app.prepare()
  .then(() => {
    console.log('> Next.js app prepared');
    const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['polling', 'websocket'],
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.use((socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie || '';
      const match = cookie.match(/session=([^;]+)/);
      if (!match) return next(new Error('Not authenticated'));
      const token = decodeURIComponent(match[1]);
      const session = verifySessionToken(token);
      if (!session) return next(new Error('Invalid session'));
      (socket as any).userId = session.userId;
      (socket as any).userName = session.name;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId as string;
    const userName = (socket as any).userName as string;
    let currentRoom: string | null = null;

    socket.on('join-room', (boardId: string) => {
      const room = `board:${boardId}`;
      if (currentRoom && currentRoom !== room) {
        socket.leave(currentRoom);
      }
      currentRoom = room;
      socket.join(room);

      socket.to(room).emit('user-joined', { userId, userName, socketId: socket.id });

      const state = roomStates.get(room);
      if (state?.currentSpeaker) {
        socket.emit('user-talking', { userId: state.currentSpeaker, userName: state.speakerName });
      }

      const sockets = io.sockets.adapter.rooms.get(room);
      if (sockets) {
        const peers: { socketId: string; userId: string; userName: string }[] = [];
        Array.from(sockets).forEach((sid) => {
          if (sid === socket.id) return;
          const peer = io.sockets.sockets.get(sid);
          if (peer) {
            peers.push({ socketId: sid, userId: (peer as any).userId, userName: (peer as any).userName });
          }
        });
        socket.emit('room-peers', peers);
      }
    });

    socket.on('leave-room', () => {
      if (currentRoom) {
        socket.leave(currentRoom);
        const state = roomStates.get(currentRoom);
        if (state?.currentSpeaker === userId) {
          state.currentSpeaker = null;
          state.speakerName = null;
          io.to(currentRoom).emit('user-stopped', { userId });
        }
        io.to(currentRoom).emit('user-left', { userId, socketId: socket.id });

        const remaining = io.sockets.adapter.rooms.get(currentRoom);
        if (!remaining || remaining.size === 0) {
          roomStates.delete(currentRoom);
        }
        currentRoom = null;
      }
    });

    socket.on('request-talk', (boardId: string, callback: (approved: boolean) => void) => {
      const room = `board:${boardId}`;
      if (!roomStates.has(room)) roomStates.set(room, { currentSpeaker: null, speakerName: null });
      const state = roomStates.get(room)!;

      if (state.currentSpeaker && state.currentSpeaker !== userId) {
        callback(false);
        return;
      }

      state.currentSpeaker = userId;
      state.speakerName = userName;
      socket.to(room).emit('user-talking', { userId, userName });
      callback(true);
    });

    socket.on('stop-talking', (boardId: string) => {
      const room = `board:${boardId}`;
      const state = roomStates.get(room);
      if (state?.currentSpeaker === userId) {
        state.currentSpeaker = null;
        state.speakerName = null;
        io.to(room).emit('user-stopped', { userId });
      }
    });

    socket.on('offer', ({ targetId, offer }: { targetId: string; offer: RTCSessionDescriptionInit }) => {
      io.to(targetId).emit('offer', { senderId: socket.id, senderName: userName, offer });
    });

    socket.on('answer', ({ targetId, answer }: { targetId: string; answer: RTCSessionDescriptionInit }) => {
      io.to(targetId).emit('answer', { senderId: socket.id, answer });
    });

    socket.on('ice-candidate', ({ targetId, candidate }: { targetId: string; candidate: RTCIceCandidateInit }) => {
      io.to(targetId).emit('ice-candidate', { senderId: socket.id, candidate });
    });

    socket.on('disconnect', () => {
      if (currentRoom) {
        const state = roomStates.get(currentRoom);
        if (state?.currentSpeaker === userId) {
          state.currentSpeaker = null;
          state.speakerName = null;
          io.to(currentRoom).emit('user-stopped', { userId });
        }
        io.to(currentRoom).emit('user-left', { userId, socketId: socket.id });

        const remaining = io.sockets.adapter.rooms.get(currentRoom);
        if (!remaining || remaining.size === 0) {
          roomStates.delete(currentRoom);
        }
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Server ready on http://${hostname}:${port}`);
  });
})
.catch((err) => {
  console.error('> Failed to prepare Next.js app:', err);
  process.exit(1);
});
