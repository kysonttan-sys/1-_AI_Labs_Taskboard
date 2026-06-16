# TURN Server for WebRTC Meetings Design Spec

## Goal

Make the existing team meeting feature work reliably across different networks by adding a TURN relay server to the WebRTC ICE configuration. Add a server-side endpoint that returns temporary TURN credentials and surface a connection-status indicator in the meeting UI.

## Scope

### In scope

- `GET /api/turn-credentials` endpoint that returns a short-lived TURN credential set (username, credential, URLs) using a shared secret mechanism compatible with Coturn / Twilio / Metered.
- The endpoint reads config from environment variables: `TURN_SERVER_URL`, `TURN_SHARED_SECRET`, `TURN_EXPIRY_SECONDS` (default 86400).
- If no TURN config is provided, the endpoint returns 204 / empty and the client falls back to STUN only.
- Update `meetingStore.ts` to fetch TURN credentials before creating `RTCPeerConnection`, merge them with the existing STUN server, and cache credentials for the session.
- Add `connectionState` tracking on each peer connection and a top-level meeting connection status in the UI.
- Show a small status badge in `TeamMeeting.tsx`: “Relay connected” / “Direct connection” / “Reconnecting”.

### Out of scope

- Hosting or configuring the actual Coturn/Twilio/Metered server (user-managed infrastructure).
- SFU or MCU server; this remains peer-to-peer.
- ICE candidate gathering timeout tuning beyond existing behavior.

## Architecture

### Server

Create `src/app/api/turn-credentials/route.ts`:
- Reads env vars.
- Generates a username in the form `<expiry>:<random>` where expiry is Unix timestamp.
- Generates password with HMAC-SHA1 of the username using `TURN_SHARED_SECRET`, base64-encoded (Coturn static-auth-secret compatible).
- Returns JSON: `{ urls: TURN_SERVER_URL, username, credential }`.
- If env vars missing, returns 204.

### Client

In `meetingStore.ts`:
- Add `turnServers: RTCIceServer[] | null` to state.
- Add `fetchTurnServers()` action that calls `/api/turn-credentials` once per session and stores result.
- In `createOfferForPeer` and `handleRemoteOffer`, call `fetchTurnServers()` first, then construct `RTCPeerConnection({ iceServers: [...ICE_SERVERS, ...(turnServers || [])] })`.
- Track connection state per peer connection and surface aggregated state.

In `TeamMeeting.tsx`:
- Display a small connection-quality badge derived from aggregated state.

### Error handling

- Missing TURN config is not an error; client uses STUN only.
- Credential fetch failure is logged and client falls back to STUN.
- Connection failures already close the peer connection; no new retry logic in this phase.

### Testing

- Type-check and build pass.
- Manual smoke test: with TURN env vars set, verify credentials are returned and used in `RTCPeerConnection` config.
