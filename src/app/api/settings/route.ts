import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireAdmin } from '@/lib/auth/permissions';

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const settings = await prisma.appSettings.findUnique({ where: { id: 'app' } });
  return NextResponse.json(settings || { setupComplete: false });
}

export async function PATCH(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

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