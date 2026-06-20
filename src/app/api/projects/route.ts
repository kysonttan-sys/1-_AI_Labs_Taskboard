import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession } from '@/lib/auth/permissions';

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const projects = await prisma.project.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      aiContext: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const { response } = await requireSession();
  if (response) return response;

  const body = await request.json();
  const { name, description, aiContext } = body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
  }

  if (name.length > 100) {
    return NextResponse.json({ error: 'Project name must be 100 characters or fewer' }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      aiContext: aiContext?.trim() || null,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
