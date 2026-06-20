import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireProjectAccess } from '@/lib/auth/permissions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { projectId } = await params;
  const access = await requireProjectAccess(session, projectId);
  if (access.response) return access.response;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      boards: { orderBy: { position: 'asc' } },
      objectives: {
        orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
        include: { keyResults: { orderBy: { position: 'asc' } } },
      },
    },
  });

  return NextResponse.json(project);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { projectId } = await params;
  const access = await requireProjectAccess(session, projectId);
  if (access.response) return access.response;

  const body = await request.json();
  const { name, description, aiContext } = body;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Project name cannot be empty' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'Project name must be 100 characters or fewer' }, { status: 400 });
    }
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(aiContext !== undefined && { aiContext: aiContext?.trim() || null }),
    },
  });

  return NextResponse.json(project);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { projectId } = await params;
  const access = await requireProjectAccess(session, projectId);
  if (access.response) return access.response;

  await prisma.project.delete({ where: { id: projectId } });

  return NextResponse.json({ ok: true });
}
