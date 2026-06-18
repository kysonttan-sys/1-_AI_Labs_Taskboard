import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireBoardAccess } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  try {
    const { boardIds } = await request.json();

    if (!Array.isArray(boardIds)) {
      return NextResponse.json({ error: 'boardIds must be an array' }, { status: 400 });
    }

    // Validate access to each board before reordering
    for (const boardId of boardIds) {
      const { response: accessResponse } = await requireBoardAccess(session, boardId);
      if (accessResponse) return accessResponse;
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
