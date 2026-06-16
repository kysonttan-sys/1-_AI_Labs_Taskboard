# TURN Server for WebRTC Meetings Implementation Plan

**Goal:** Add TURN relay support to team meetings via a server-side credentials endpoint and update the meeting store to use them.

---

## Task 1: TURN credentials API

**Files:**
- Create: `src/app/api/turn-credentials/route.ts`
- Modify: `.env.example`

### Step 1: Create credentials endpoint

Create `src/app/api/turn-credentials/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

function generateTurnCredentials(sharedSecret: string, expirySeconds: number = 86400) {
  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
  const nonce = crypto.randomBytes(8).toString('hex');
  const username = `${expiry}:${nonce}`;
  const credential = crypto
    .createHmac('sha1', sharedSecret)
    .update(username)
    .digest('base64');
  return { username, credential, expiry };
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const serverUrl = process.env.TURN_SERVER_URL;
  const sharedSecret = process.env.TURN_SHARED_SECRET;
  if (!serverUrl || !sharedSecret) {
    return new NextResponse(null, { status: 204 });
  }

  const expirySeconds = Number(process.env.TURN_EXPIRY_SECONDS || '86400');
  const { username, credential } = generateTurnCredentials(sharedSecret, expirySeconds);

  return NextResponse.json({
    urls: serverUrl.split(','),
    username,
    credential,
  });
}
```

### Step 2: Document env vars in `.env.example`

Add to the bottom of `.env.example`:

```bash
# TURN server for WebRTC meetings (optional; format: turn:host:port or turns:host:port)
# TURN_SERVER_URL=turn:turn.example.com:3478
# TURN_SHARED_SECRET=your-static-auth-secret
# TURN_EXPIRY_SECONDS=86400
```

### Step 3: Commit

```bash
git add src/app/api/turn-credentials/route.ts .env.example
git commit -m "feat(turn): add TURN credentials endpoint

GET /api/turn-credentials returns Coturn-compatible time-limited
credentials when TURN_SERVER_URL and TURN_SHARED_SECRET are set.
Returns 204 if TURN is not configured so the client falls back to STUN.

Refs: docs/superpowers/specs/2026-06-15-turn-server-design.md"
```

---

## Task 2: Integrate TURN into meeting store

**Files:**
- Modify: `src/features/meeting/meetingStore.ts`

### Step 1: Add TURN state and fetch action

Add to state interface:

```typescript
  turnServers: RTCIceServer[] | null;
  connectionState: 'unknown' | 'connected' | 'relayed' | 'failed';
  fetchTurnServers: () => Promise<void>;
```

Add initial state:

```typescript
  turnServers: null,
  connectionState: 'unknown',
```

Add action:

```typescript
  fetchTurnServers: async () => {
    if (get().turnServers) return;
    try {
      const res = await fetch('/api/turn-credentials');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.urls) {
        set({ turnServers: { urls: data.urls, username: data.username, credential: data.credential } });
      }
    } catch {
      // ignore, fallback to STUN
    }
  },
```

### Step 2: Use merged ICE servers when creating peer connections

Replace `const ICE_SERVERS` constant with a helper function:

```typescript
function getIceServers(turnServers: RTCIceServer[] | null): RTCIceServer[] {
  return [{ urls: 'stun:stun.l.google.com:19302' }, ...(turnServers || [])];
}
```

In `createOfferForPeer` and `handleRemoteOffer`, await `get().fetchTurnServers()` first, then use:

```typescript
const iceServers = getIceServers(get().turnServers);
const pc = new RTCPeerConnection({ iceServers });
```

### Step 3: Track connection state

On each peer connection, add:

```typescript
pc.onconnectionstatechange = () => {
  const state = get();
  let aggregate: MeetingState['connectionState'] = 'unknown';
  const states = Array.from(state.peerConnections.values()).map((c) => c.pc.connectionState);
  if (states.some((s) => s === 'failed' || s === 'closed')) aggregate = 'failed';
  else if (states.some((s) => s === 'connected')) aggregate = 'connected';
  else if (states.some((s) => s === 'connecting')) aggregate = 'unknown';
  set({ connectionState: aggregate });
};
```

### Step 4: Commit

```bash
git add src/features/meeting/meetingStore.ts
git commit -m "feat(turn): use TURN servers in meeting peer connections

Meeting store fetches TURN credentials once per session and merges
them with the STUN server when creating RTCPeerConnections. Tracks
aggregate connection state for UI feedback.

Refs: docs/superpowers/specs/2026-06-15-turn-server-design.md"
```

---

## Task 3: Connection status UI

**Files:**
- Modify: `src/components/meeting/TeamMeeting.tsx`

### Step 1: Display status badge

Add to the header near the Live indicator:

```tsx
const { connectionState } = useMeetingStore();
const statusLabel =
  connectionState === 'connected' ? 'Direct' :
  connectionState === 'relayed' ? 'Relay' :
  connectionState === 'failed' ? 'Connection issue' : 'Connecting...';
const statusColor =
  connectionState === 'connected' ? 'text-green-400' :
  connectionState === 'relayed' ? 'text-amber-400' :
  connectionState === 'failed' ? 'text-red-400' : 'text-[var(--text-tertiary)]';
```

Render:

```tsx
<span className={`text-xs ${statusColor}`}>{statusLabel}</span>
```

### Step 2: Commit

```bash
git add src/components/meeting/TeamMeeting.tsx
git commit -m "feat(turn): show meeting connection status badge

TeamMeeting header shows Direct/Relay/Connecting/Connection issue
state derived from peer connection states.

Refs: docs/superpowers/specs/2026-06-15-turn-server-design.md"
```

---

## Task 4: Verify and push

```bash
npx tsc --noEmit
npm run build
git push origin main
```
