import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { hashPin } from '@/lib/auth/pin';
import { createSessionToken } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, pin } = body;

    if (!name || !pin) {
      return NextResponse.json(
        { error: 'Name and PIN are required' },
        { status: 400 }
      );
    }

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
        name,
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

    response.cookies.set('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}