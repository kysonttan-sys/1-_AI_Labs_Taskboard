import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { hashPin } from '@/lib/auth/pin';
import { createSessionToken, COOKIE_OPTIONS } from '@/lib/auth/session';
import { isRateLimited, getRateLimitKey } from '@/lib/security/rateLimit';
import { isNonEmptyString } from '@/lib/security/input';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(getRateLimitKey(request, 'setup'))) {
      return NextResponse.json(
        { error: 'Too many setup attempts. Please try again later.' },
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

    const normalizedName = name.trim().slice(0, 100);

    const settings = await prisma.appSettings.findUnique({
      where: { id: 'app' },
    });

    if (settings?.setupComplete) {
      return NextResponse.json(
        { error: 'Setup has already been completed' },
        { status: 403 }
      );
    }

    const hashedPin = await hashPin(pin);

    const user = await prisma.user.create({
      data: {
        name: normalizedName,
        pin: hashedPin,
        role: 'admin',
      },
    });

    await prisma.appSettings.upsert({
      where: { id: 'app' },
      update: { setupComplete: true },
      create: {
        id: 'app',
        setupComplete: true,
      },
    });

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