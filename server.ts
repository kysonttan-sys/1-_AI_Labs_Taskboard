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
    const SECRET = getSecret();
    const parts = token.split(':');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = crypto.createHash('sha256').update(SECRET).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const payload = JSON.parse(decrypted) as { userId: string; name: string; role: string; exp?: number };
    if (!payload.exp || Date.now() > payload.exp) return null;
    return { userId: payload.userId, name: payload.name, role: payload.role };
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

interface MeetingParticipant {
  userId: string;
  userName: string;
  muted: boolean;
  screenSharing: boolean;
}

const meetingRooms = new Map<string, Map<string, MeetingParticipant>>();

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

  function getMeetingParticipants(room: string): (MeetingParticipant & { socketId: string })[] {
    const participants = meetingRooms.get(room);
    if (!participants) return [];
    return Array.from(participants.entries()).map(([socketId, p]) => ({ socketId, ...p }));
  }

  function broadcastParticipants(room: string) {
    io.to(room).emit('meeting-participants', getMeetingParticipants(room));
  }

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
    let currentMeeting: string | null = null;

    socket.on('join-meeting', (room: string) => {
      if (currentMeeting && currentMeeting !== room) {
        socket.leave(currentMeeting);
        const prevRoom = meetingRooms.get(currentMeeting);
        if (prevRoom) {
          prevRoom.delete(socket.id);
          if (prevRoom.size === 0) meetingRooms.delete(currentMeeting);
          broadcastParticipants(currentMeeting);
        }
      }

      currentMeeting = room;
      socket.join(room);

      if (!meetingRooms.has(room)) meetingRooms.set(room, new Map());
      meetingRooms.get(room)!.set(socket.id, { userId, userName, muted: true, screenSharing: false });

      broadcastParticipants(room);

      socket.to(room).emit('user-joined-meeting', { socketId: socket.id, userId, userName });
    });

    socket.on('leave-meeting', () => {
      if (!currentMeeting) return;
      socket.leave(currentMeeting);
      const room = meetingRooms.get(currentMeeting);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) meetingRooms.delete(currentMeeting);
        broadcastParticipants(currentMeeting);
      }
      socket.to(currentMeeting).emit('user-left-meeting', { socketId: socket.id, userId });
      currentMeeting = null;
    });

    socket.on('meeting-toggle-mute', ({ muted }: { muted: boolean }) => {
      if (!currentMeeting) return;
      const room = meetingRooms.get(currentMeeting);
      const participant = room?.get(socket.id);
      if (participant) {
        participant.muted = muted;
        broadcastParticipants(currentMeeting);
      }
    });

    socket.on('meeting-screen-share', ({ screenSharing }: { screenSharing: boolean }) => {
      if (!currentMeeting) return;
      const room = meetingRooms.get(currentMeeting);
      const participant = room?.get(socket.id);
      if (participant) {
        participant.screenSharing = screenSharing;
        broadcastParticipants(currentMeeting);
      }
    });

    socket.on('meeting-offer', ({ targetId, offer, kind }: { targetId: string; offer: RTCSessionDescriptionInit; kind: 'audio' | 'screen' }) => {
      io.to(targetId).emit('meeting-offer', { senderId: socket.id, senderName: userName, offer, kind });
    });

    socket.on('meeting-answer', ({ targetId, answer, kind }: { targetId: string; answer: RTCSessionDescriptionInit; kind: 'audio' | 'screen' }) => {
      io.to(targetId).emit('meeting-answer', { senderId: socket.id, answer, kind });
    });

    socket.on('meeting-ice-candidate', ({ targetId, candidate, kind }: { targetId: string; candidate: RTCIceCandidateInit; kind: 'audio' | 'screen' }) => {
      io.to(targetId).emit('meeting-ice-candidate', { senderId: socket.id, candidate, kind });
    });

    socket.on('disconnect', () => {
      if (!currentMeeting) return;
      socket.leave(currentMeeting);
      const room = meetingRooms.get(currentMeeting);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) meetingRooms.delete(currentMeeting);
        broadcastParticipants(currentMeeting);
      }
      socket.to(currentMeeting).emit('user-left-meeting', { socketId: socket.id, userId });
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
