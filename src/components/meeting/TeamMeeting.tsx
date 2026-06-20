'use client';

import { useEffect, useRef } from 'react';
import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Users, Radio, User } from 'lucide-react';
import { useMeetingStore, type MeetingParticipant } from '@/features/meeting/meetingStore';
import { useAuthStore } from '@/features/auth/authStore';

export default function TeamMeeting() {
  const { user } = useAuthStore();
  const {
    joined,
    participants,
    muted,
    screenSharing,
    error,
    connectionState,
    turnServers,
    joinMeeting,
    leaveMeeting,
    toggleMute,
    toggleScreenShare,
    localAudioStream,
    localScreenStream,
  } = useMeetingStore();

  const localAudioRef = useRef<HTMLAudioElement>(null);

  // Keep local audio element in sync so the user can hear themselves? No, mute local playback.
  useEffect(() => {
    if (localAudioRef.current && localAudioStream) {
      localAudioRef.current.srcObject = localAudioStream;
      localAudioRef.current.muted = true;
    }
  }, [localAudioStream]);

  if (!joined) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center">
          <Users className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Team Meeting</h2>
          <p className="text-sm text-[var(--text-tertiary)] max-w-xs">
            Join the room to start an audio meeting with your team. Share your screen when you need to present.
          </p>
        </div>
        <button
          onClick={() => joinMeeting('team')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-medium transition-colors"
        >
          <Radio className="h-4 w-4" />
          Join Meeting
        </button>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
      </div>
    );
  }

  // Defensive deduplication: if the same userId appears multiple times (e.g.
  // reconnection race), keep only the newest socket id entry.
  const seen = new Map<string, MeetingParticipant>();
  for (const p of participants) {
    if (p.userId === user?.id) continue;
    const existing = seen.get(p.userId);
    if (!existing || p.socketId > existing.socketId) {
      seen.set(p.userId, p);
    }
  }
  const others = Array.from(seen.values());

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium text-[var(--text-primary)]">Live</span>
          </div>
          <span className="text-sm text-[var(--text-tertiary)]">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
          <span
            className={`text-xs ${
              connectionState === 'connected'
                ? 'text-green-400'
                : connectionState === 'relayed'
                ? 'text-amber-400'
                : connectionState === 'failed'
                ? 'text-red-400'
                : 'text-[var(--text-tertiary)]'
            }`}
            title={!turnServers ? 'No TURN server configured; calls may fail across strict networks' : undefined}
          >
            {connectionState === 'connected'
              ? 'Direct'
              : connectionState === 'relayed'
              ? 'Relay'
              : connectionState === 'failed'
              ? 'Connection issue'
              : 'Connecting...'}
            {!turnServers && ' · no TURN'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${muted
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40'
              }`}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {muted ? 'Muted' : 'Unmute'}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${screenSharing
                ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40'
              }`}
          >
            {screenSharing ? <MonitorX className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
            {screenSharing ? 'Stop Share' : 'Share Screen'}
          </button>

          <button
            onClick={leaveMeeting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
          >
            <PhoneOff className="h-4 w-4" />
            Leave
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* Participants + screen shares */}
        <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
          {/* Screen share grid */}
          {[localScreenStream, ...others.map((p) => p.screenStream)].filter(Boolean).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localScreenStream && (
                <div className="relative rounded-lg overflow-hidden border border-[var(--border)] bg-black aspect-video">
                  <video
                    autoPlay
                    playsInline
                    muted
                    ref={(el) => { if (el) el.srcObject = localScreenStream; }}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium">
                    Your screen
                  </div>
                </div>
              )}
              {others.map((p) =>
                p.screenStream ? (
                  <div key={`${p.socketId}-screen`} className="relative rounded-lg overflow-hidden border border-[var(--border)] bg-black aspect-video">
                    <video
                      autoPlay
                      playsInline
                      ref={(el) => { if (el) el.srcObject = p.screenStream || null; }}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium">
                      {p.userName}&apos;s screen
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Participant cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <ParticipantCard
              name={user?.name || 'You'}
              muted={muted}
              isLocal
              speaking={!muted && !!localAudioStream && localAudioStream.getAudioTracks().some((t) => t.enabled && !t.muted)}
              screenSharing={screenSharing}
            />
            {others.map((p) => (
              <RemoteParticipantCard key={p.socketId} participant={p} />
            ))}
          </div>
        </div>
      </div>

      <audio ref={localAudioRef} autoPlay playsInline muted />
    </div>
  );
}

function ParticipantCard({
  name,
  muted,
  isLocal,
  speaking,
  screenSharing,
}: {
  name: string;
  muted: boolean;
  isLocal?: boolean;
  speaking?: boolean;
  screenSharing?: boolean;
}) {
  return (
    <div className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors
      ${speaking ? 'border-[var(--accent)] bg-[var(--accent-muted)]' : 'border-[var(--border)] bg-[var(--bg-elevated)]'}
    `}>
      <div className="relative">
        <div className="h-14 w-14 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center">
          <User className="h-7 w-7 text-[var(--text-tertiary)]" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[var(--bg-base)] border border-[var(--border)] flex items-center justify-center">
          {muted ? <MicOff className="h-3 w-3 text-red-400" /> : <Mic className="h-3 w-3 text-green-400" />}
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[120px]">
          {name} {isLocal && <span className="text-[var(--text-tertiary)]">(you)</span>}
        </p>
        {screenSharing && (
          <p className="text-[10px] text-[var(--accent)] flex items-center justify-center gap-1 mt-0.5">
            <MonitorUp className="h-3 w-3" /> Sharing
          </p>
        )}
      </div>
    </div>
  );
}

function RemoteParticipantCard({ participant }: { participant: MeetingParticipant }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audioRef.current || !participant.audioStream) return;
    const audioEl = audioRef.current;
    audioEl.srcObject = participant.audioStream;
    audioEl.play().catch(() => {});

    // When a user joins muted, the remote audio track starts muted and the
    // audio element may pause. Ensure playback resumes as soon as they unmute.
    const handlers = participant.audioStream.getAudioTracks().map((track) => {
      const handleUnmute = () => {
        audioEl.play().catch(() => {});
      };
      track.addEventListener('unmute', handleUnmute);
      return { track, handleUnmute };
    });

    return () => {
      handlers.forEach(({ track, handleUnmute }) => {
        track.removeEventListener('unmute', handleUnmute);
      });
    };
  }, [participant.audioStream]);

  // Determine if participant is speaking by checking audio track activity? WebRTC doesn't give easy speaking detection.
  // For simplicity, show unmuted as active.
  const speaking = !participant.muted;

  return (
    <div className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors
      ${speaking ? 'border-[var(--accent)] bg-[var(--accent-muted)]' : 'border-[var(--border)] bg-[var(--bg-elevated)]'}
    `}>
      <div className="relative">
        <div className="h-14 w-14 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center">
          <User className="h-7 w-7 text-[var(--text-tertiary)]" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-[var(--bg-base)] border border-[var(--border)] flex items-center justify-center">
          {participant.muted ? <MicOff className="h-3 w-3 text-red-400" /> : <Mic className="h-3 w-3 text-green-400" />}
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[120px]">{participant.userName}</p>
        {participant.screenSharing && (
          <p className="text-[10px] text-[var(--accent)] flex items-center justify-center gap-1 mt-0.5">
            <MonitorUp className="h-3 w-3" /> Sharing
          </p>
        )}
      </div>
      <audio ref={audioRef} autoPlay playsInline />
    </div>
  );
}
