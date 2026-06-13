import { NextResponse } from 'next/server';
import { checkOllamaConnection, resolveOllamaUrl } from '@/features/ai/ollamaClient';
import { isAIEnabled } from '@/lib/ai/config';

export const dynamic = 'force-dynamic';

// Quick reachability check used by Render's health probe or by the
// browser after setting OLLAMA_URL. Returns the resolved URL (so the
// caller can confirm env-var wiring) and which models are visible.
export async function GET() {
  if (!isAIEnabled()) {
    return NextResponse.json({ connected: false, reason: 'ai_disabled' }, { status: 503 });
  }
  const url = resolveOllamaUrl();
  const { connected, models } = await checkOllamaConnection(url);
  return NextResponse.json(
    { connected, url, models },
    { status: connected ? 200 : 502 }
  );
}
