import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireProjectAccess } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export type PromptType = 'focus' | 'suggest-okrs' | 'suggest-tasks' | 'missing-steps' | 'project-next-steps' | 'custom';

function fmtDate(date: Date | string | null) {
  if (!date) return 'no date';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtPercent(current: number, target: number) {
  if (!target) return '0%';
  return `${Math.round((current / target) * 100)}%`;
}

async function buildGlobalContext() {
  const [projects, objectives, cards] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: 'asc' } }),
    prisma.objective.findMany({
      orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
      include: {
        project: { select: { name: true } },
        keyResults: { orderBy: { position: 'asc' } },
        owner: { select: { name: true } },
      },
    }),
    prisma.card.findMany({
      include: {
        board: { select: { id: true, name: true, projectId: true, project: { select: { name: true } } } },
        list: { select: { title: true } },
        assignees: { include: { user: { select: { name: true } } } },
        keyResults: { include: { keyResult: { select: { title: true, objective: { select: { title: true } } } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
  ]);

  const projectCtx = projects
    .map(
      (p) =>
        `- Project "${p.name}"${p.description ? `: ${p.description}` : ''}${p.aiContext ? `\n  Context: ${p.aiContext}` : ''}`,
    )
    .join('\n');

  const okrCtx = objectives
    .map((o) => {
      const krs = o.keyResults
        .map(
          (kr) =>
            `    - ${kr.title}: ${kr.current} / ${kr.target}${kr.unit ? ` ${kr.unit}` : ''} (${fmtPercent(kr.current, kr.target)})`,
        )
        .join('\n');
      return `- ${o.title} (project: ${o.project.name}, owner: ${o.owner?.name || 'unassigned'}, due ${fmtDate(o.endDate)})\n${krs || '    - no key results'}`;
    })
    .join('\n');

  const cardCtx = cards
    .map((c) => {
      const assignees = c.assignees.map((a) => a.user.name).join(', ') || 'unassigned';
      const krs = c.keyResults.map(({ keyResult }) => keyResult.title).join(', ');
      return `- ${c.title} (status: ${c.status}, list: ${c.list.title}, board: ${c.board.name}, project: ${c.board.project.name}, assignees: ${assignees}, due: ${fmtDate(c.dueDate)}${krs ? `, linked KRs: ${krs}` : ''})`;
    })
    .join('\n');

  return { projectCtx, okrCtx, cardCtx, userName: '' };
}

async function buildProjectContext(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      boards: {
        include: {
          lists: {
            include: {
              cards: {
                include: {
                  assignees: { include: { user: { select: { name: true } } } },
                  keyResults: { include: { keyResult: { select: { title: true } } } },
                },
                orderBy: { position: 'asc' },
              },
            },
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { position: 'asc' },
      },
      objectives: {
        orderBy: [{ position: 'asc' }, { endDate: 'asc' }],
        include: {
          keyResults: { orderBy: { position: 'asc' } },
          owner: { select: { name: true } },
        },
      },
    },
  });

  if (!project) return null;

  const projectCtx = `- Project "${project.name}"${project.description ? `: ${project.description}` : ''}${project.aiContext ? `\n  Context: ${project.aiContext}` : ''}`;

  const okrCtx = project.objectives
    .map((o) => {
      const krs = o.keyResults
        .map(
          (kr) =>
            `    - ${kr.title}: ${kr.current} / ${kr.target}${kr.unit ? ` ${kr.unit}` : ''} (${fmtPercent(kr.current, kr.target)})`,
        )
        .join('\n');
      return `- ${o.title} (owner: ${o.owner?.name || 'unassigned'}, due ${fmtDate(o.endDate)})\n${krs || '    - no key results'}`;
    })
    .join('\n');

  const cardLines: string[] = [];
  project.boards.forEach((board) => {
    board.lists.forEach((list) => {
      list.cards.forEach((c) => {
        const assignees = c.assignees.map((a) => a.user.name).join(', ') || 'unassigned';
        const krs = c.keyResults.map(({ keyResult }) => keyResult.title).join(', ');
        cardLines.push(
          `- ${c.title} (status: ${c.status}, list: ${list.title}, board: ${board.name}, assignees: ${assignees}, due: ${fmtDate(c.dueDate)}${krs ? `, linked KRs: ${krs}` : ''})`,
        );
      });
    });
  });

  return { projectCtx, okrCtx, cardCtx: cardLines.join('\n'), userName: '' };
}

function buildSystemPrompt() {
  return `You are a practical project-management AI. Use the provided project/OKR/task context to answer concisely. Be specific, cite task or OKR names when relevant, and suggest concrete, actionable next steps. Do not invent facts that are not in the context. If you are unsure, say so.`;
}

function buildUserPrompt(
  type: PromptType,
  context: Awaited<ReturnType<typeof buildGlobalContext>>,
  customQuestion?: string,
) {
  const base = `Project context:\n${context.projectCtx || 'No projects'}\n\nOKRs:\n${context.okrCtx || 'No OKRs'}\n\nTasks:\n${context.cardCtx || 'No tasks'}`;

  if (type === 'custom' && customQuestion) {
    return `${base}\n\nAnswer the following question using the context above:\n${customQuestion}`;
  }

  switch (type) {
    case 'focus':
      return `${base}\n\nBased on overdue tasks, upcoming deadlines, and OKR progress, what should the team focus on this week? Give 3-5 specific priorities.`;
    case 'suggest-okrs':
      return `${base}\n\nSuggest 1-3 objectives with 2-3 key results each that fit this project. Include targets, units, and deadlines. Keep it concise and realistic.`;
    case 'suggest-tasks':
      return `${base}\n\nSuggest 3-5 concrete next tasks that would advance the project/OKRs. Mention which objective/key result each task supports, if any.`;
    case 'missing-steps':
      return `${base}\n\nReview the tasks and OKRs. What important steps or risks seem to be missing? Give 3-5 practical gaps to address.`;
    case 'project-next-steps':
      return `${base}\n\nGiven the project context, OKRs, and current tasks, what are the most important next steps for this project? Provide 3-5 actionable items.`;
    default:
      return `${base}\n\nWhat should the team focus on next? Provide 3-5 actionable suggestions.`;
  }
}

export async function POST(request: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  const ollamaUrl = process.env.OLLAMA_URL;
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1';
  const ollamaApiKey = process.env.OLLAMA_API_KEY;
  const ollamaBasicAuth = process.env.OLLAMA_BASIC_AUTH;

  if (!ollamaUrl) {
    return NextResponse.json(
      {
        suggestion:
          'AI assistant is not configured yet. The admin needs to set OLLAMA_URL and OLLAMA_MODEL. Important: Ollama itself has no built-in API key. If you expose it with Tailscale Funnel, you must also run a reverse proxy (Caddy/Nginx) with an API key or basic auth in front of Ollama.',
      },
      { status: 503 },
    );
  }

  let body: { promptType?: unknown; projectId?: unknown; question?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const promptType = (body.promptType as PromptType) || 'focus';
  const projectId = typeof body.projectId === 'string' ? body.projectId : undefined;
  const question = typeof body.question === 'string' ? body.question : undefined;

  if (projectId) {
    const access = await requireProjectAccess(session, projectId);
    if (access.response) return access.response;
  }

  const context = projectId ? await buildProjectContext(projectId) : await buildGlobalContext();
  if (!context) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const prompt = buildUserPrompt(promptType, context, question);

  try {
    const url = `${ollamaUrl.replace(/\/$/, '')}/api/generate`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (ollamaBasicAuth) {
      headers['authorization'] = `Basic ${Buffer.from(ollamaBasicAuth).toString('base64')}`;
    } else if (ollamaApiKey) {
      // Tailscale Funnel can strip/interfere with the standard Authorization header, so we send
      // the token in a custom header. The Caddy/Nginx proxy in front of Ollama checks this header.
      headers['x-taskboard-key'] = ollamaApiKey;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
        system: buildSystemPrompt(),
        options: { temperature: 0.7 },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { suggestion: `Ollama returned an error (${res.status}${text ? `: ${text.slice(0, 200)}` : ''}). Please check that Ollama is running and the model "${ollamaModel}" is pulled.` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const suggestion = typeof data.response === 'string' ? data.response : JSON.stringify(data);

    return NextResponse.json({ suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        suggestion:
          `Could not reach the local Ollama instance. ` +
          `Make sure: 1) Ollama is running on your PC, ` +
          `2) the upstream proxy/reverse proxy is running, ` +
          `3) Tailscale Funnel is active, ` +
          `4) OLLAMA_URL on Render points to the correct https://...ts.net URL. (${message})`,
      },
      { status: 503 },
    );
  }
}
