import { Ollama } from 'ollama';

// Cache Ollama clients per resolved URL so callers that pass an explicit
// host (e.g. the settings page letting the user point to a different
// machine) don't get served a stale client from a previous URL. The
// default-URL singleton is preserved on the special key DEFAULT_KEY
// so the common case (no explicit host) still avoids re-instantiation.
const DEFAULT_KEY = '__default__';
const ollamaClients = new Map<string, Ollama>();

/**
 * Resolves the Ollama base URL in this priority:
 *   1. Explicit argument (the caller's choice)
 *   2. OLLAMA_URL env var (set on Render / production)
 *   3. http://localhost:11434 (local dev)
 */
export function resolveOllamaUrl(explicit?: string | null): string {
  if (explicit) return explicit;
  if (process.env.OLLAMA_URL) return process.env.OLLAMA_URL;
  return 'http://localhost:11434';
}

export function getOllamaClient(url?: string | null): Ollama {
  const resolved = resolveOllamaUrl(url);
  const key = url ? resolved : DEFAULT_KEY;
  const cached = ollamaClients.get(key);
  if (cached) return cached;
  const client = new Ollama({ host: resolved });
  ollamaClients.set(key, client);
  return client;
}

export async function* streamChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  host?: string | null
): AsyncGenerator<string> {
  const ollama = getOllamaClient(host);
  const response = await ollama.chat({ model, messages, stream: true });

  for await (const chunk of response) {
    if (chunk.message?.content) {
      yield chunk.message.content;
    }
    if (chunk.done) break;
  }
}

export async function checkOllamaConnection(host?: string | null): Promise<{ connected: boolean; models: string[] }> {
  try {
    const ollama = getOllamaClient(host);
    const models = await ollama.list();
    return { connected: true, models: models.models.map((m) => m.name) };
  } catch {
    return { connected: false, models: [] };
  }
}