import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  const body = await request.json();
  const { title, position } = body;

  try {
    const list = await prisma.list.update({
      where: { id: listId },
      data: {
        ...(title !== undefined && { title }),
        ...(position !== undefined && { position }),
      },
    });
    return NextResponse.json(list);
  } catch {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;

  try {
    await prisma.list.delete({ where: { id: listId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }
}