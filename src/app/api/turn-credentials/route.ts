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
