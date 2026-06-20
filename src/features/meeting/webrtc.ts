import type { Socket } from 'socket.io-client';
import type { MeetingParticipant } from './meetingStore';

interface PeerConnection {
  pc: RTCPeerConnection;
  socketId: string;
  kind: 'audio' | 'screen';
}

export function getIceServers(turnServers: RTCIceServer[] | null): RTCIceServer[] {
  return [{ urls: 'stun:stun.l.google.com:19302' }, ...(turnServers || [])];
}

const bufferedCandidates = new Map<RTCPeerConnection, RTCIceCandidateInit[]>();

export function bufferCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): void {
  const buffered = bufferedCandidates.get(pc) || [];
  buffered.push(candidate);
  bufferedCandidates.set(pc, buffered);
}

export async function flushBufferedCandidates(pc: RTCPeerConnection): Promise<void> {
  const buffered = bufferedCandidates.get(pc);
  if (!buffered) return;
  for (const c of buffered) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    } catch {
      // ignore stale candidates
    }
  }
  bufferedCandidates.delete(pc);
}

export function cleanupPeerConnection(pc: RTCPeerConnection): void {
  bufferedCandidates.delete(pc);
  pc.close();
}

interface CreateOfferDeps {
  socket: Socket;
  turnServers: RTCIceServer[] | null;
  participants: MeetingParticipant[];
  addPeerConnection: (key: string, conn: PeerConnection) => void;
  addOrUpdateParticipant: (participant: MeetingParticipant) => void;
  onRemoteTrack?: (socketId: string, kind: 'audio' | 'screen', track: MediaStreamTrack, stream: MediaStream) => void;
  onConnectionStateChange?: (socketId: string, kind: 'audio' | 'screen', state: RTCPeerConnectionState) => void;
}

export async function createOfferForPeer(
  targetId: string,
  kind: 'audio' | 'screen',
  stream: MediaStream | null,
  deps: CreateOfferDeps
): Promise<void> {
  const { socket, turnServers, participants, addPeerConnection, addOrUpdateParticipant, onRemoteTrack, onConnectionStateChange } = deps;

  const key = `${targetId}:${kind}`;

  const pc = new RTCPeerConnection({ iceServers: getIceServers(turnServers) });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('meeting-ice-candidate', { targetId, candidate: event.candidate, kind });
    }
  };

  pc.onconnectionstatechange = () => {
    onConnectionStateChange?.(targetId, kind, pc.connectionState);
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      cleanupPeerConnection(pc);
    }
  };

  if (stream) {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  }

  pc.ontrack = (event) => {
    const remoteStream = event.streams[0] || new MediaStream([event.track]);
    addOrUpdateParticipant({
      ...(participants.find((p) => p.socketId === targetId) || {
        socketId: targetId,
        userId: '',
        userName: 'Unknown',
        muted: true,
        screenSharing: false,
      }),
      ...(kind === 'audio' ? { audioStream: remoteStream } : { screenStream: remoteStream }),
    });
    onRemoteTrack?.(targetId, kind, event.track, remoteStream);
  };

  addPeerConnection(key, { pc, socketId: targetId, kind });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('meeting-offer', { targetId, offer, kind });
}

interface HandleOfferDeps {
  socket: Socket;
  turnServers: RTCIceServer[] | null;
  localAudioStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  participants: MeetingParticipant[];
  addPeerConnection: (key: string, conn: PeerConnection) => void;
  addOrUpdateParticipant: (participant: MeetingParticipant) => void;
  onRemoteTrack?: (socketId: string, kind: 'audio' | 'screen', track: MediaStreamTrack, stream: MediaStream) => void;
  onConnectionStateChange?: (socketId: string, kind: 'audio' | 'screen', state: RTCPeerConnectionState) => void;
}

export async function handleRemoteOffer(
  senderId: string,
  senderName: string,
  offer: RTCSessionDescriptionInit,
  kind: 'audio' | 'screen',
  deps: HandleOfferDeps
): Promise<void> {
  const {
    socket,
    turnServers,
    localAudioStream,
    localScreenStream,
    participants,
    addPeerConnection,
    addOrUpdateParticipant,
    onRemoteTrack,
    onConnectionStateChange,
  } = deps;

  const key = `${senderId}:${kind}`;

  // Update participant metadata
  const existing = participants.find((p) => p.socketId === senderId);
  if (!existing) {
    addOrUpdateParticipant({
      socketId: senderId,
      userId: '',
      userName: senderName,
      muted: true,
      screenSharing: false,
    });
  }

  const pc = new RTCPeerConnection({ iceServers: getIceServers(turnServers) });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('meeting-ice-candidate', { targetId: senderId, candidate: event.candidate, kind });
    }
  };

  pc.onconnectionstatechange = () => {
    onConnectionStateChange?.(senderId, kind, pc.connectionState);
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      cleanupPeerConnection(pc);
    }
  };

  // Add our local tracks
  const localStream = kind === 'audio' ? localAudioStream : localScreenStream;
  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  pc.ontrack = (event) => {
    const remoteStream = event.streams[0] || new MediaStream([event.track]);
    const participant = participants.find((p) => p.socketId === senderId) || {
      socketId: senderId,
      userId: '',
      userName: senderName,
      muted: true,
      screenSharing: false,
    };
    addOrUpdateParticipant({
      ...participant,
      ...(kind === 'audio' ? { audioStream: remoteStream } : { screenStream: remoteStream }),
    });
    onRemoteTrack?.(senderId, kind, event.track, remoteStream);
  };

  addPeerConnection(key, { pc, socketId: senderId, kind });

  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('meeting-answer', { targetId: senderId, answer, kind });
}
