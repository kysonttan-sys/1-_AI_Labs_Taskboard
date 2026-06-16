import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const { boardIds } = await request.json();

    if (!Array.isArray(boardIds)) {
      return NextResponse.json({ error: 'boardIds must be an array' }, { status: 400 });
    }

    // Update positions in a transaction
    await prisma.$transaction(
      boardIds.map((id: string, index: number) =>
        prisma.board.update({
          where: { id },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to reorder boards' }, { status: 500 });
  }
}
