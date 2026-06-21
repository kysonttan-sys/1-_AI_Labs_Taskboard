import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireSession, requireProjectAccess } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export type RefineField =
  | 'card-title'
  | 'card-description'
  | 'objective-title'
  | 'objective-description'
  | 'key-result-title'
  | 'project-context';

interface RefineBody {
  field?: RefineField;
  currentText?: string;
  projectId?: string;
  objectiveId?: string;
  cardId?: string;
  extraContext?: string;
}

async function loadContext(body: RefineBody) {
  const project = body.projectId
    ? await prisma.project.findUnique({
        where: { id: body.projectId },
        select: { id: true, name: true, description: true, aiContext: true },
      })
    : null;

  const objective = body.objectiveId
    ? await prisma.objective.findUnique({
        where: { id: body.objectiveId },
        select: { id: true, title: true, description: true, projectId: true },
      })
    : null;

  const card = body.cardId
    ? await prisma.card.findUnique({
        where: { id: body.cardId },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          board: { select: { id: true, name: true, projectId: true, project: { select: { name: true } } } },
          list: { select: { title: true } },
        },
      })
    : null;

  return { project, objective, card };
}

function buildPrompt(field: RefineField, currentText: string, ctx: Awaited<ReturnType<typeof loadContext>>, extraContext?: string) {
  const { project, objective, card } = ctx;

  const base = [
    `You are a practical project-management writing assistant.`,
    `Keep the answer concise and directly usable. Do not add explanations, markdown, or bullet points unless the field asks for a list.`,
  ].join(' ');

  const contextParts = [];
  if (project) contextParts.push(`Project: ${project.name}${project.description ? ` — ${project.description}` : ''}`);
  if (objective) contextParts.push(`Objective: ${objective.title}`);
  if (card) {
    contextParts.push(
      `Board: ${card.board.name}`,
      `List: ${card.list.title}`,
      card.title !== currentText ? `Card title: ${card.title}` : '',
    );
  }
  if (extraContext) contextParts.push(extraContext);
  const context = contextParts.filter(Boolean).join('\n');

  switch (field) {
    case 'card-title':
      return `${base}\n\n${context}\n\nSuggest a clear, concise card title (max 80 chars) for a task about this idea:\n"${currentText || 'a new task'}"\n\nReturn only the title.`;
    case 'card-description':
      return `${base}\n\n${context}\n\nWrite a concise task description for a card titled "${card?.title || currentText}".\n\nCurrent draft:\n"${currentText}"\n\nReturn only the description, 1-3 short sentences.`;
    case 'objective-title':
      return `${base}\n\n${context}\n\nSuggest a clear OKR objective title for the project above, based on this idea:\n"${currentText || 'a new objective'}"\n\nReturn only the title.`;
    case 'objective-description':
      return `${base}\n\n${context}\n\nObjective: "${objective?.title || currentText}"\n\nExpand this into a 1-2 sentence description that explains the objective. Return only the description.`;
    case 'key-result-title':
      return `${base}\n\n${context}\n\nSuggest a measurable key result title supporting the objective above, based on this idea:\n"${currentText || 'a measurable outcome'}"\n\nInclude a metric if possible. Return only the title.`;
    case 'project-context':
      return `${base}\n\nProject: ${project?.name}${project?.description ? ` — ${project.description}` : ''}\n\nExisting context draft:\n"${currentText}"\n\nRewrite this into a clear project overview paragraph for an AI assistant to understand. Return only the paragraph.`;
    default:
      return `${base}\n\n${context}\n\nImprove this text:\n"${currentText}"\n\nReturn only the improved version.`;
  }
}

function cleanSuggestion(text: string) {
  return text
    .replace(/^\s*["“”']|["“”']\s*$/g, '')
    .replace(/^\s*-+\s*/gm, '')
    .trim();
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
      { suggestion: '', error: 'AI assistant is not configured. Set OLLAMA_URL and OLLAMA_MODEL.' },
      { status: 503 },
    );
  }

  let body: RefineBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const field = body.field;
  if (!field || !['card-title', 'card-description', 'objective-title', 'objective-description', 'key-result-title', 'project-context'].includes(field)) {
    return NextResponse.json({ error: 'Invalid or missing field' }, { status: 400 });
  }

  if (body.projectId) {
    const access = await requireProjectAccess(session, body.projectId);
    if (access.response) return access.response;
  }

  const ctx = await loadContext(body);
  const prompt = buildPrompt(field, body.currentText || '', ctx, body.extraContext);

  try {
    const url = `${ollamaUrl.replace(/\/$/, '')}/api/generate`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (ollamaBasicAuth) {
      headers['authorization'] = `Basic ${Buffer.from(ollamaBasicAuth).toString('base64')}`;
    } else if (ollamaApiKey) {
      headers['x-taskboard-key'] = ollamaApiKey;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
        system: 'You are a helpful writing assistant. Return only the requested text, no extra commentary.',
        options: { temperature: 0.6 },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { suggestion: '', error: `Ollama error (${res.status}${text ? `: ${text.slice(0, 200)}` : ''})` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const raw = typeof data.response === 'string' ? data.response : JSON.stringify(data);
    const suggestion = cleanSuggestion(raw);

    return NextResponse.json({ suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ suggestion: '', error: `Could not reach Ollama. (${message})` }, { status: 503 });
  }
}
