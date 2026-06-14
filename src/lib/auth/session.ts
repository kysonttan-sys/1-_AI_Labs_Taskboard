import { cookies } from 'next/headers';
import * as crypto from 'crypto';

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

export interface SessionData {
  userId: string;
  name: string;
  role: string;
}

export function createSessionToken(data: SessionData): string {
  const SECRET = getSecret();
  const payload = JSON.stringify(data);
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function verifySessionToken(token: string): SessionData | null {
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
    return JSON.parse(decrypted) as SessionData;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;
  return verifySessionToken(token);
}