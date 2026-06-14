import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 'app' } });
  return NextResponse.json(settings || { setupComplete: false });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  // Only allow updating specific fields
  const allowedFields = ['setupComplete'];
  const data: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      data[key] = body[key];
    }
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: 'app' },
    update: data,
    create: { id: 'app', ...data },
  });
  return NextResponse.json(settings);
}