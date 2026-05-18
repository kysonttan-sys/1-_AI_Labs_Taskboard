import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { streamChat } from '@/features/ai/ollamaClient';
import { buildChatContext } from '@/features/ai/contextBuilders';
import { CHAT_SYSTEM_PROMPT } from '@/features/ai/prompts';
import { isAIEnabled } from '@/lib/ai/config';

export async function POST(request: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json({ error: 'AI features are not available in this deployment' }, { status: 503 });
  }
  try {
    const { messages, boardId, cardId } = await request.json();

    const settings = await prisma.appSettings.findUnique({ where: { id: 'app' } });
    const ollamaUrl = settings?.ollamaUrl || 'http://localhost:11434';
    const model = settings?.ollamaModel || 'kimi-k2.6:cloud';

    const context = await buildChatContext(boardId, cardId);
    const systemPrompt = CHAT_SYSTEM_PROMPT + (context ? '\n\n' + context : '');

    const fullMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Save user message to DB
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'user') {
        await prisma.aIChatMessage.create({
          data: {
            role: 'user',
            content: lastMsg.content,
            context: context ? 'board+card' : null,
            boardId: boardId || null,
            cardId: cardId || null,
          },
        });
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';
        try {
          for await (const token of streamChat(model, fullMessages, ollamaUrl)) {
            fullContent += token;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content: token })}\n\n`)
            );
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );

          // Save assistant message to DB
          await prisma.aIChatMessage.create({
            data: {
              role: 'assistant',
              content: fullContent,
              context: context ? 'board+card' : null,
              boardId: boardId || null,
              cardId: cardId || null,
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}