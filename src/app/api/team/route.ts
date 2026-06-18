import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireAdmin } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { session, response } = await requireAdmin();
  if (!session) return response;

  const { name, pin, color, jobTitle } = await request.json();
  if (!name || !pin) return NextResponse.json({ error: 'Name and PIN are required' }, { status: 400 });

  const bcrypt = await import('bcryptjs');
  const hashedPin = await bcrypt.hash(pin, 10);
  const user = await prisma.user.create({
    data: {
      name,
      pin: hashedPin,
      color: color || '#6366f1',
      role: 'member',
      jobTitle: jobTitle ? jobTitle.trim() : null,
    },
  });
  return NextResponse.json({
    id: user.id,
    name: user.name,
    color: user.color,
    role: user.role,
    jobTitle: user.jobTitle,
  });
}

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireAdmin();
  if (!session) return response;

  const { userId, role, jobTitle } = await request.json();
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  const data: { role?: string; jobTitle?: string | null } = {};

  if (role !== undefined) {
    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'role must be admin or member' }, { status: 400 });
    }

    // Prevent self-demotion if there would be no admin left
    if (session.userId === userId && role !== 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'At least one admin is required. Promote another admin first.' },
          { status: 400 }
        );
      }
    }

    data.role = role;
  }

  if (jobTitle !== undefined) {
    data.jobTitle = jobTitle ? jobTitle.trim() : null;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, color: true, role: true, jobTitle: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(request: NextRequest) {
  const { session, response } = await requireAdmin();
  if (!session) return response;

  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
