import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import {
  createOfferForPeer,
  handleRemoteOffer,
  flushBufferedCandidates,
  bufferCandidate,
  cleanupPeerConnection,
} from './webrtc';

export interface MeetingParticipant {
  socketId: string;
  userId: string;
  userName: string;
  muted: boolean;
  screenSharing: boolean;
  audioStream?: MediaStream;
  screenStream?: MediaStream;
}

interface PeerConnection {
  pc: RTCPeerConnection;
  socketId: string;
  kind: 'audio' | 'screen';
}

interface MeetingState {
  joined: boolean;
  room: string;
  localAudioStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  muted: boolean;
  screenSharing: boolean;
  participants: MeetingParticipant[];
  error: string | null;
  socket: Socket | null;
  peerConnections: Map<string, PeerConnection>;
  peerConnectionStates: Map<string, RTCPeerConnectionState>;
  turnServers: RTCIceServer[] | null;
  connectionState: 'unknown' | 'connected' | 'relayed' | 'failed';

  initSocket: () => Socket;
  fetchTurnServers: () => Promise<void>;
  joinMeeting: (room: string) => Promise<void>;
  leaveMeeting: () => void;
  toggleMute: () => void;
  toggleScreenShare: () => Promise<void>;
  setError: (error: string | null) => void;

  // Internal actions exposed for the component/socket handlers
  _setSocket: (socket: Socket | null) => void;
  _setParticipants: (participants: MeetingParticipant[]) => void;
  _addOrUpdateParticipant: (participant: MeetingParticipant) => void;
  _removeParticipant: (socketId: string) => void;
  _setLocalAudioStream: (stream: MediaStream | null) => void;
  _setLocalScreenStream: (stream: MediaStream | null) => void;
  _setJoined: (joined: boolean) => void;
  _setMuted: (muted: boolean) => void;
  _setScreenSharing: (screenSharing: boolean) => void;
  _addPeerConnection: (key: string, pc: PeerConnection) => void;
  _removePeerConnection: (key: string) => void;
  _setPeerConnectionState: (socketId: string, kind: 'audio' | 'screen', state: RTCPeerConnectionState) => void;
  _onRemoteTrack: (socketId: string, kind: 'audio' | 'screen', track: MediaStreamTrack, stream: MediaStream) => void;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  joined: false,
  room: 'team',
  localAudioStream: null,
  localScreenStream: null,
  muted: true,
  screenSharing: false,
  participants: [],
  error: null,
  socket: null,
  peerConnections: new Map(),
  peerConnectionStates: new Map(),
  turnServers: null,
  connectionState: 'unknown',

  fetchTurnServers: async () => {
    if (get().turnServers) return;
    try {
      const res = await fetch('/api/turn-credentials');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.urls) {
        set({ turnServers: [{ urls: data.urls, username: data.username, credential: data.credential }] });
      }
    } catch {
      // ignore, fallback to STUN
    }
  },

  initSocket: () => {
    let socket = get().socket;
    if (socket?.connected) return socket;

    socket = io({
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 60000,
      path: '/socket.io/',
    });

    socket.on('connect', () => {
      set({ error: null });
    });

    socket.on('connect_error', (err) => {
      console.error('[Meeting] socket connect_error:', err);
      set({ error: 'Meeting connection failed' });
    });

    socket.on('meeting-kicked', ({ reason }: { reason: string }) => {
      get().leaveMeeting();
      set({ error: `Removed from meeting: ${reason}` });
    });

    socket.on('disconnect', () => {
      get().leaveMeeting();
    });

    socket.on('meeting-participants', async (participants: MeetingParticipant[]) => {
      set({ participants });

      // Symmetric negotiation: when we get the full participant list after
      // joining, create offers to any existing participants we don't already
      // have a peer connection with.
      const state = get();
      if (!state.joined || !state.socket) return;
      const onRemoteTrack = state._onRemoteTrack;
      const onConnectionStateChange = state._setPeerConnectionState;
      for (const p of participants) {
        if (p.socketId === state.socket.id) continue;
        if (state.peerConnections.has(`${p.socketId}:audio`)) continue;
        await createOfferForPeer(p.socketId, 'audio', state.localAudioStream, {
          socket: state.socket,
          turnServers: state.turnServers,
          participants: state.participants,
          addPeerConnection: state._addPeerConnection,
          addOrUpdateParticipant: state._addOrUpdateParticipant,
          onRemoteTrack,
          onConnectionStateChange,
        });
      }
    });

    socket.on('user-joined-meeting', async ({ socketId, userId, userName }: { socketId: string; userId: string; userName: string }) => {
      const state = get();
      if (state.joined && socket.id !== socketId) {
        get()._addOrUpdateParticipant({ socketId, userId, userName, muted: true, screenSharing: false });
        await createOfferForPeer(socketId, 'audio', state.localAudioStream, {
          socket,
          turnServers: state.turnServers,
          participants: state.participants,
          addPeerConnection: state._addPeerConnection,
          addOrUpdateParticipant: state._addOrUpdateParticipant,
          onRemoteTrack: state._onRemoteTrack,
          onConnectionStateChange: state._setPeerConnectionState,
        });
        if (state.screenSharing && state.localScreenStream) {
          await createOfferForPeer(socketId, 'screen', state.localScreenStream, {
            socket,
            turnServers: state.turnServers,
            participants: state.participants,
            addPeerConnection: state._addPeerConnection,
            addOrUpdateParticipant: state._addOrUpdateParticipant,
            onRemoteTrack: state._onRemoteTrack,
            onConnectionStateChange: state._setPeerConnectionState,
          });
        }
      }
    });

    socket.on('user-left-meeting', ({ socketId }: { socketId: string }) => {
      get()._removeParticipant(socketId);
      const state = get();
      for (const [key, conn] of Array.from(state.peerConnections.entries())) {
        if (conn.socketId === socketId) {
          cleanupPeerConnection(conn.pc);
          state.peerConnections.delete(key);
        }
      }
      set({ peerConnections: new Map(state.peerConnections) });
    });

    socket.on('meeting-offer', async ({ senderId, senderName, offer, kind }: { senderId: string; senderName: string; offer: RTCSessionDescriptionInit; kind: 'audio' | 'screen' }) => {
      const state = get();
      await handleRemoteOffer(senderId, senderName, offer, kind, {
        socket,
        turnServers: state.turnServers,
        localAudioStream: state.localAudioStream,
        localScreenStream: state.localScreenStream,
        participants: state.participants,
        addPeerConnection: state._addPeerConnection,
        addOrUpdateParticipant: state._addOrUpdateParticipant,
        onRemoteTrack: state._onRemoteTrack,
        onConnectionStateChange: state._setPeerConnectionState,
      });
    });

    socket.on('meeting-answer', async ({ senderId, answer, kind }: { senderId: string; answer: RTCSessionDescriptionInit; kind: 'audio' | 'screen' }) => {
      const key = `${senderId}:${kind}`;
      const conn = get().peerConnections.get(key);
      if (conn?.pc) {
        try {
          await conn.pc.setRemoteDescription(answer);
          await flushBufferedCandidates(conn.pc);
        } catch (e) {
          console.error('[Meeting] setRemoteDescription answer failed:', e);
        }
      }
    });

    socket.on('meeting-ice-candidate', async ({ senderId, candidate, kind }: { senderId: string; candidate: RTCIceCandidateInit; kind: 'audio' | 'screen' }) => {
      const key = `${senderId}:${kind}`;
      const conn = get().peerConnections.get(key);
      if (conn?.pc) {
        if (conn.pc.remoteDescription) {
          try { await conn.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
        } else {
          bufferCandidate(conn.pc, candidate);
        }
      }
    });

    set({ socket });
    return socket;
  },

  joinMeeting: async (room) => {
    await get().fetchTurnServers();
    const socket = get().initSocket();
    if (!socket.connected) {
      await new Promise<void>((resolve) => {
        socket.once('connect', resolve);
        setTimeout(resolve, 3000);
      });
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false; // Start muted
      });
      set({ localAudioStream: stream, muted: true, joined: true, room });
      socket.emit('join-meeting', room);
    } catch (err) {
      console.error('[Meeting] Microphone access denied:', err);
      set({ error: 'Microphone access is required to join the meeting.' });
    }
  },

  leaveMeeting: () => {
    const state = get();
    state.socket?.emit('leave-meeting');
    state.peerConnections.forEach((conn) => {
      cleanupPeerConnection(conn.pc);
    });
    state.localAudioStream?.getTracks().forEach((t) => t.stop());
    state.localScreenStream?.getTracks().forEach((t) => t.stop());
    set({
      joined: false,
      localAudioStream: null,
      localScreenStream: null,
      muted: true,
      screenSharing: false,
      participants: [],
      peerConnections: new Map(),
      peerConnectionStates: new Map(),
      connectionState: 'unknown',
    });
  },

  toggleMute: () => {
    const state = get();
    if (!state.localAudioStream) return;
    const nextMuted = !state.muted;
    state.localAudioStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    set({ muted: nextMuted });
    state.socket?.emit('meeting-toggle-mute', { muted: nextMuted });
  },

  toggleScreenShare: async () => {
    const state = get();
    if (!state.socket) return;
    if (state.screenSharing) {
      state.localScreenStream?.getTracks().forEach((t) => t.stop());
      set({ localScreenStream: null, screenSharing: false });
      state.socket?.emit('meeting-screen-share', { screenSharing: false });
      for (const [key, conn] of Array.from(state.peerConnections.entries())) {
        if (conn.kind === 'screen') {
          conn.pc.close();
          state.peerConnections.delete(key);
        }
      }
      set({ peerConnections: new Map(state.peerConnections) });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          get().toggleScreenShare();
        };
      });
      set({ localScreenStream: stream, screenSharing: true });
      state.socket?.emit('meeting-screen-share', { screenSharing: true });

      for (const p of state.participants) {
        if (p.socketId === state.socket?.id) continue;
        await createOfferForPeer(p.socketId, 'screen', stream, {
          socket: state.socket,
          turnServers: state.turnServers,
          participants: state.participants,
          addPeerConnection: state._addPeerConnection,
          addOrUpdateParticipant: state._addOrUpdateParticipant,
          onRemoteTrack: state._onRemoteTrack,
          onConnectionStateChange: state._setPeerConnectionState,
        });
      }
    } catch (err) {
      console.error('[Meeting] Screen share failed:', err);
      set({ error: 'Screen sharing was cancelled or failed.' });
    }
  },

  setError: (error) => set({ error }),

  _setSocket: (socket) => set({ socket }),
  _setParticipants: (participants) => set({ participants }),
  _addOrUpdateParticipant: (participant) =>
    set((s) => ({
      participants: [
        ...s.participants.filter((p) => p.socketId !== participant.socketId),
        participant,
      ],
    })),
  _removeParticipant: (socketId) =>
    set((s) => ({
      participants: s.participants.filter((p) => p.socketId !== socketId),
    })),
  _setLocalAudioStream: (stream) => set({ localAudioStream: stream }),
  _setLocalScreenStream: (stream) => set({ localScreenStream: stream }),
  _setJoined: (joined) => set({ joined }),
  _setMuted: (muted) => set({ muted }),
  _setScreenSharing: (screenSharing) => set({ screenSharing }),
  _addPeerConnection: (key, pc) =>
    set((s) => {
      const map = new Map(s.peerConnections);
      map.set(key, pc);
      return { peerConnections: map };
    }),
  _removePeerConnection: (key) =>
    set((s) => {
      const map = new Map(s.peerConnections);
      map.delete(key);
      const states = new Map(s.peerConnectionStates);
      states.delete(key);
      return { peerConnections: map, peerConnectionStates: states };
    }),
  _setPeerConnectionState: (socketId, kind, state) =>
    set((s) => {
      const key = `${socketId}:${kind}`;
      const states = new Map(s.peerConnectionStates);
      states.set(key, state);

      // Aggregate audio peer connection states into a single UI state.
      let hasFailed = false;
      let hasConnected = false;
      for (const conn of Array.from(s.peerConnections.values())) {
        if (conn.kind !== 'audio') continue;
        const connState = states.get(`${conn.socketId}:audio`) || 'new';
        if (connState === 'failed' || connState === 'closed') {
          hasFailed = true;
        } else if (connState === 'connected') {
          hasConnected = true;
        }
      }

      let connectionState: 'unknown' | 'connected' | 'relayed' | 'failed' = 'unknown';
      if (hasFailed && !hasConnected) connectionState = 'failed';
      else if (hasConnected) connectionState = 'connected';

      return { peerConnectionStates: states, connectionState };
    }),
  _onRemoteTrack: () => {
    // Components observe participant.audioStream directly; no store action needed.
  },
}));
