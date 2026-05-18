import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { hashPin } from '@/lib/auth/pin';
import { createSessionToken } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const { name, pin } = await request.json();

    if (!name || !pin) {
      return NextResponse.json({ error: 'Name and PIN are required' }, { status: 400 });
    }

    if (pin.length < 4) {
      return NextResponse.json({ error: 'PIN must be at least 4 digits' }, { status: 400 });
    }

    // Check if name is already taken
    const existing = await prisma.user.findFirst({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'Name already taken' }, { status: 409 });
    }

    const hashedPin = await hashPin(pin);
    const user = await prisma.user.create({
      data: { name, pin: hashedPin, role: 'member' },
    });

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

    response.cookies.set('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}