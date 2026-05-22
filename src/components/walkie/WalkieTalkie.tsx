'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Mic, Radio, AlertCircle, User } from 'lucide-react';
import { useWalkieStore } from '@/features/walkie/walkieStore';

interface WalkieTalkieProps {
  boardId: string;
  userId: string;
  userName: string;
}

export default function WalkieTalkie({ boardId, userId, userName }: WalkieTalkieProps) {
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pttActiveRef = useRef(false);

  const {
    isConnected,
    isTransmitting,
    currentSpeaker,
    peers,
    setConnected,
    setTransmitting,
    setCurrentSpeaker,
    setPeers,
    addPeer,
    removePeer,
    setError,
  } = useWalkieStore();

  const [permissionDenied, setPermissionDenied] = useState(false);

  const closePeerConnection = useCallback((socketId: string) => {
    const pc = peerConnectionsRef.current.get(socketId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(socketId);
    }
    const audioEl = audioElementsRef.current.get(socketId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioElementsRef.current.delete(socketId);
    }
  }, []);

  const cleanupAllConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    audioElementsRef.current.forEach((el) => {
      el.srcObject = null;
    });
    audioElementsRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }, []);

  const cleanupReceivingConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((pc, id) => {
      const senders = pc.getSenders();
      if (senders.length === 0) {
        pc.close();
        peerConnectionsRef.current.delete(id);
        const audioEl = audioElementsRef.current.get(id);
        if (audioEl) {
          audioEl.srcObject = null;
          audioElementsRef.current.delete(id);
        }
      }
    });
  }, []);

  const createPeerConnectionAndOffer = useCallback(
    async (targetId: string, stream: MediaStream) => {
      const socket = socketRef.current;
      if (!socket) return;

      try {
        if (peerConnectionsRef.current.has(targetId)) return;

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', { targetId, candidate: event.candidate });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            closePeerConnection(targetId);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        peerConnectionsRef.current.set(targetId, pc);
        socket.emit('offer', { targetId, offer });
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    },
    [closePeerConnection]
  );

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    socket.on('connect_error', (err) => {
      setConnected(false);
      setError('Connection failed');
      console.error('Socket connection error:', err);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setTransmitting(false);
      setCurrentSpeaker(null);
      setPeers([]);
      cleanupAllConnections();
    });

    socket.on('room-peers', (roomPeers: { socketId: string; userId: string; userName: string }[]) => {
      setPeers(roomPeers);
    });

    socket.on('user-joined', (peer: { socketId: string; userId: string; userName: string }) => {
      addPeer(peer);
      if (pttActiveRef.current && localStreamRef.current) {
        createPeerConnectionAndOffer(peer.socketId, localStreamRef.current);
      }
    });

    socket.on('user-left', ({ socketId }: { socketId: string }) => {
      removePeer(socketId);
      closePeerConnection(socketId);
    });

    socket.on('user-talking', ({ userId: uid, userName: speakerName }: { userId: string; userName: string }) => {
      setCurrentSpeaker({ userId: uid, userName: speakerName });
    });

    socket.on('user-stopped', () => {
      setCurrentSpeaker(null);
      cleanupReceivingConnections();
    });

    socket.on(
      'offer',
      async ({
        senderId,
        senderName,
        offer,
      }: {
        senderId: string;
        senderName: string;
        offer: RTCSessionDescriptionInit;
      }) => {
        try {
          if (peerConnectionsRef.current.has(senderId)) return;

          const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          });

          pc.ontrack = (event) => {
            const stream = event.streams[0];
            let audioEl = audioElementsRef.current.get(senderId);
            if (!audioEl) {
              audioEl = new Audio();
              audioEl.autoplay = true;
              audioElementsRef.current.set(senderId, audioEl);
            }
            audioEl.srcObject = stream;
          };

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('ice-candidate', { targetId: senderId, candidate: event.candidate });
            }
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
              closePeerConnection(senderId);
            }
          };

          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          peerConnectionsRef.current.set(senderId, pc);
          socket.emit('answer', { targetId: senderId, answer });
        } catch (err) {
          console.error('Error handling offer:', err);
        }
      }
    );

    socket.on('answer', async ({ senderId, answer }: { senderId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnectionsRef.current.get(senderId);
      if (pc) {
        try {
          await pc.setRemoteDescription(answer);
        } catch (err) {
          console.error('Error setting remote description:', err);
        }
      }
    });

    socket.on(
      'ice-candidate',
      async ({ senderId, candidate }: { senderId: string; candidate: RTCIceCandidateInit }) => {
        const pc = peerConnectionsRef.current.get(senderId);
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('Error adding ICE candidate:', err);
          }
        }
      }
    );

    return () => {
      socket.disconnect();
      cleanupAllConnections();
    };
  }, [
    setConnected,
    setError,
    setTransmitting,
    setCurrentSpeaker,
    setPeers,
    addPeer,
    removePeer,
    createPeerConnectionAndOffer,
    closePeerConnection,
    cleanupAllConnections,
    cleanupReceivingConnections,
  ]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    socket.emit('join-room', boardId);

    return () => {
      socket.emit('leave-room');
      cleanupAllConnections();
      setCurrentSpeaker(null);
      setPeers([]);
    };
  }, [boardId, isConnected, cleanupAllConnections, setCurrentSpeaker, setPeers]);

  useEffect(() => {
    setPermissionDenied(false);
  }, [boardId]);

  const startTalking = useCallback(async () => {
    if (pttActiveRef.current) return;
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    pttActiveRef.current = true;

    socket.emit('request-talk', boardId, (approved: boolean) => {
      if (!approved || !pttActiveRef.current) {
        pttActiveRef.current = false;
        return;
      }

      setTransmitting(true);

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          localStreamRef.current = stream;
          peers.forEach((peer) => {
            createPeerConnectionAndOffer(peer.socketId, stream);
          });
        })
        .catch((err) => {
          console.error('Microphone access denied:', err);
          setPermissionDenied(true);
          setTransmitting(false);
          pttActiveRef.current = false;
          socket.emit('stop-talking', boardId);
        });
    });
  }, [boardId, isConnected, peers, createPeerConnectionAndOffer, setTransmitting]);

  const stopTalking = useCallback(() => {
    if (!pttActiveRef.current) return;
    pttActiveRef.current = false;
    setTransmitting(false);

    const socket = socketRef.current;
    if (socket) {
      socket.emit('stop-talking', boardId);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    audioElementsRef.current.forEach((el) => {
      el.srcObject = null;
    });
    audioElementsRef.current.clear();
  }, [boardId, setTransmitting]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        startTalking();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        stopTalking();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startTalking, stopTalking]);

  const isBlocked = !isConnected || (!!currentSpeaker && currentSpeaker.userId !== userId) || permissionDenied;
  const isButtonDisabled = isBlocked && !isTransmitting;

  return (
    <div className="border-b border-[var(--border)] p-3 space-y-2 bg-[var(--bg-base)]/50">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Radio className={`h-3.5 w-3.5 ${isConnected ? 'text-emerald-400' : 'text-gray-600'}`} />
          <span className={isConnected ? 'text-emerald-400' : 'text-gray-500'}>
            {isConnected ? 'Connected' : 'Offline'}
          </span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-500">{peers.length} online</span>
        </div>
        {currentSpeaker && (
          <div className="flex items-center gap-1.5 text-amber-400 animate-pulse">
            <User className="h-3.5 w-3.5" />
            <span className="font-medium">{currentSpeaker.userName} is talking...</span>
          </div>
        )}
      </div>

      {peers.length > 0 && (
        <div className="flex items-center gap-1">
          {peers.map((peer) => (
            <div
              key={peer.socketId}
              className="h-6 w-6 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[10px] text-gray-400"
              title={peer.userName}
            >
              {peer.userName.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}

      <button
        onMouseDown={startTalking}
        onMouseUp={stopTalking}
        onMouseLeave={stopTalking}
        onTouchStart={(e) => {
          e.preventDefault();
          startTalking();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          stopTalking();
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          stopTalking();
        }}
        disabled={isButtonDisabled}
        className={`w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all select-none
          ${isTransmitting
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
            : currentSpeaker
            ? 'bg-[var(--bg-card)] text-gray-500 border border-[var(--border)] cursor-not-allowed'
            : permissionDenied
            ? 'bg-red-500/10 text-red-400 border border-red-500/30 cursor-not-allowed'
            : 'bg-[var(--bg-card)] text-gray-300 border border-[var(--border)] hover:border-emerald-500/40 hover:text-emerald-400 active:scale-[0.98]'
          }`}
      >
        <Mic className={`h-4 w-4 ${isTransmitting ? 'animate-bounce' : ''}`} />
        {isTransmitting
          ? 'Transmitting...'
          : currentSpeaker
          ? `${currentSpeaker.userName} is talking`
          : permissionDenied
          ? 'Mic Blocked'
          : 'Push to Talk (Hold Space)'}
      </button>

      {permissionDenied && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400">
          <AlertCircle className="h-3 w-3" />
          <span>Microphone access denied. Check browser permissions.</span>
        </div>
      )}
    </div>
  );
}
