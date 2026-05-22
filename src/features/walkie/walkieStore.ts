import { create } from 'zustand';

export interface WalkiePeer {
  socketId: string;
  userId: string;
  userName: string;
}

interface WalkieState {
  isConnected: boolean;
  isTransmitting: boolean;
  currentSpeaker: { userId: string; userName: string } | null;
  peers: WalkiePeer[];
  connectionError: string | null;
  setConnected: (connected: boolean) => void;
  setTransmitting: (transmitting: boolean) => void;
  setCurrentSpeaker: (speaker: { userId: string; userName: string } | null) => void;
  setPeers: (peers: WalkiePeer[]) => void;
  addPeer: (peer: WalkiePeer) => void;
  removePeer: (socketId: string) => void;
  setError: (error: string | null) => void;
}

export const useWalkieStore = create<WalkieState>((set) => ({
  isConnected: false,
  isTransmitting: false,
  currentSpeaker: null,
  peers: [],
  connectionError: null,
  setConnected: (connected) => set({ isConnected: connected }),
  setTransmitting: (transmitting) => set({ isTransmitting: transmitting }),
  setCurrentSpeaker: (speaker) => set({ currentSpeaker: speaker }),
  setPeers: (peers) => set({ peers }),
  addPeer: (peer) =>
    set((s) => ({
      peers: [...s.peers.filter((p) => p.socketId !== peer.socketId), peer],
    })),
  removePeer: (socketId) =>
    set((s) => ({ peers: s.peers.filter((p) => p.socketId !== socketId) })),
  setError: (error) => set({ connectionError: error }),
}));
