import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { verifyPin } from '@/lib/auth/pin';
import { createSessionToken, COOKIE_OPTIONS } from '@/lib/auth/session';
import { requireSession } from '@/lib/auth/permissions';
import { isRateLimited, getRateLimitKey } from '@/lib/security/rateLimit';
import { isNonEmptyString } from '@/lib/security/input';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { session, response } = await requireSession();
  if (!session) return response;

  const name = request.nextUrl.searchParams.get('name');
  if (!isNonEmptyString(name)) {
    return NextResponse.json(
      { error: 'Name is required' },
      { status: 400 }
    );
  }

  const user = await prisma.user.findFirst({
    where: { name },
    select: { id: true, name: true, role: true, color: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(user);
}

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(getRateLimitKey(request, 'login'))) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, pin } = body;

    if (!isNonEmptyString(name) || !isNonEmptyString(pin)) {
      return NextResponse.json(
        { error: 'Name and PIN are required' },
        { status: 400 }
      );
    }

    if (pin.length < 4) {
      return NextResponse.json(
        { error: 'PIN must be at least 4 digits' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({ where: { name } });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid name or PIN' },
        { status: 401 }
      );
    }

    const valid = await verifyPin(pin, user.pin);

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid name or PIN' },
        { status: 401 }
      );
    }

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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const { session, response: authResponse } = await requireSession();
  if (!session) return authResponse;

  const response = NextResponse.json({ success: true });

  response.cookies.set('session', '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });

  return response;
}