import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { checkOllamaConnection } from '@/features/ai/ollamaClient';
import { isAIEnabled } from '@/lib/ai/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAIEnabled()) {
    return NextResponse.json({ connected: false, models: [], currentModel: '', ollamaUrl: '', disabled: true });
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: 'app' } });
  const ollamaUrl = settings?.ollamaUrl || 'http://localhost:11434';

  const { connected, models } = await checkOllamaConnection(ollamaUrl);

  return NextResponse.json({ connected, models, currentModel: settings?.ollamaModel || 'kimi-k2.6:cloud', ollamaUrl });
}