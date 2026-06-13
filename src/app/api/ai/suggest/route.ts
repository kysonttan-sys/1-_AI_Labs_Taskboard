import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getOllamaClient } from '@/features/ai/ollamaClient';
import { buildSuggestionContext } from '@/features/ai/contextBuilders';
import { SUGGESTION_SYSTEM_PROMPT } from '@/features/ai/prompts';
import { isAIEnabled } from '@/lib/ai/config';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SuggestionSchema = z.object({
  suggestions: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('assignment'),
        cardTitle: z.string(),
        suggestedAssignee: z.string(),
        reason: z.string(),
        confidence: z.number().min(0).max(1),
      }),
      z.object({
        type: z.literal('duration'),
        cardTitle: z.string(),
        estimatedDays: z.number(),
        reason: z.string(),
        confidence: z.number().min(0).max(1),
      }),
      z.object({
        type: z.literal('bottleneck'),
        description: z.string(),
        affectedCards: z.array(z.string()),
        suggestion: z.string(),
      }),
    ])
  ),
});

export async function POST(request: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json({ error: 'AI features are not available in this deployment' }, { status: 503 });
  }
  try {
    const { boardId } = await request.json();
    if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });

    const settings = await prisma.appSettings.findUnique({ where: { id: 'app' } });
    const ollamaUrl = settings?.ollamaUrl || 'http://localhost:11434';
    const model = settings?.ollamaModel || 'kimi-k2.6:cloud';

    const context = await buildSuggestionContext(boardId);
    const messages = [
      { role: 'system' as const, content: SUGGESTION_SYSTEM_PROMPT + context },
      { role: 'user' as const, content: 'Analyze this board and provide suggestions for task assignments, duration estimates, and bottleneck detection.' },
    ];

    const ollama = getOllamaClient(ollamaUrl);
    const response = await ollama.chat({ model, messages, stream: false });

    // Parse the response, stripping any markdown code fences
    let content = response.message.content.trim();
    content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

    try {
      const parsed = SuggestionSchema.parse(JSON.parse(content));
      return NextResponse.json(parsed);
    } catch {
      // If parsing fails, return raw content
      return NextResponse.json({ raw: content, error: 'Could not parse structured suggestions' });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}