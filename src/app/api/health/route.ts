import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

// Liveness + DB reachability check for Render's health probe. We don't
// auth-gate this: it's a yes/no signal for the platform, not user data.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: 'up' });
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: 'down', error: (e as Error).message },
      { status: 503 }
    );
  }
}
