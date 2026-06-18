import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { hashPin } from '@/lib/auth/pin';
import { createSessionToken, COOKIE_OPTIONS } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth/permissions';
import { isRateLimited, getRateLimitKey } from '@/lib/security/rateLimit';
import { isNonEmptyString } from '@/lib/security/input';
import { Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    if (isRateLimited(getRateLimitKey(request, 'register'))) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const { name, pin } = await request.json();

    if (!isNonEmptyString(name) || !isNonEmptyString(pin)) {
      return NextResponse.json({ error: 'Name and PIN are required' }, { status: 400 });
    }

    if (pin.length < 4) {
      return NextResponse.json({ error: 'PIN must be at least 4 digits' }, { status: 400 });
    }

    const normalizedName = name.trim().slice(0, 100);

    const hashedPin = await hashPin(pin);
    let user;
    try {
      user = await prisma.user.create({
        data: { name: normalizedName, pin: hashedPin, role: 'member' },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json({ error: 'Name already taken' }, { status: 409 });
      }
      throw e;
    }

    // Auto-login after registration
    const token = createSessionToken({
      userId: user.id,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      role: user.role,
      color: user.color,
    });

    response.cookies.set('session', token, COOKIE_OPTIONS);

    return response;
  } catch {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}