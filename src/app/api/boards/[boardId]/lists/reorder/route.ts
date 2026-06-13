import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const { listIds } = await request.json();

    if (!Array.isArray(listIds)) {
      return NextResponse.json({ error: 'listIds must be an array' }, { status: 400 });
    }

    await prisma.$transaction(
      listIds.map((id: string, index: number) =>
        prisma.list.update({
          where: { id },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to reorder lists' }, { status: 500 });
  }
}