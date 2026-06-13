import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getOllamaClient } from '@/features/ai/ollamaClient';
import { buildDigestContext } from '@/features/ai/contextBuilders';
import { DIGEST_SYSTEM_PROMPT } from '@/features/ai/prompts';
import { isAIEnabled } from '@/lib/ai/config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json({ error: 'AI features are not available in this deployment' }, { status: 503 });
  }
  try {
    const { boardId } = await request.json();

    const settings = await prisma.appSettings.findUnique({ where: { id: 'app' } });
    const ollamaUrl = settings?.ollamaUrl || 'http://localhost:11434';
    const model = settings?.ollamaModel || 'kimi-k2.6:cloud';

    const context = await buildDigestContext(boardId);
    const messages = [
      { role: 'system' as const, content: DIGEST_SYSTEM_PROMPT + context },
      { role: 'user' as const, content: 'Generate a weekly digest for this board.' },
    ];

    const ollama = getOllamaClient(ollamaUrl);
    const response = await ollama.chat({ model, messages, stream: false });

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = now;

    const digest = await prisma.aIDigest.create({
      data: {
        weekStart,
        weekEnd,
        summary: response.message.content,
        boardId: boardId || null,
      },
    });

    return NextResponse.json(digest);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}