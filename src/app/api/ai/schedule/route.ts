import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getOllamaClient } from '@/features/ai/ollamaClient';
import { buildChatContext } from '@/features/ai/contextBuilders';
import { SCHEDULE_SYSTEM_PROMPT } from '@/features/ai/prompts';
import { isAIEnabled } from '@/lib/ai/config';
import { z } from 'zod';

const SchedulePlanSchema = z.object({
  projectName: z.string(),
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      listName: z.string(),
      startDate: z.string(),
      dueDate: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
      assigneeName: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
      progress: z.number().default(0),
    })
  ),
});

export async function POST(request: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json({ error: 'AI features are not available in this deployment' }, { status: 503 });
  }
  try {
    const { boardId, goal } = await request.json();
    if (!boardId || !goal) return NextResponse.json({ error: 'boardId and goal are required' }, { status: 400 });

    const settings = await prisma.appSettings.findUnique({ where: { id: 'app' } });
    const ollamaUrl = settings?.ollamaUrl || 'http://localhost:11434';
    const model = settings?.ollamaModel || 'kimi-k2.6:cloud';

    const context = await buildChatContext(boardId);
    const messages = [
      { role: 'system' as const, content: SCHEDULE_SYSTEM_PROMPT + context },
      { role: 'user' as const, content: `Create a project plan for: ${goal}` },
    ];

    const ollama = getOllamaClient(ollamaUrl);
    const response = await ollama.chat({ model, messages, stream: false });

    let content = response.message.content.trim();
    content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

    try {
      const parsed = SchedulePlanSchema.parse(JSON.parse(content));
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ raw: content, error: 'Could not parse schedule plan' });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}