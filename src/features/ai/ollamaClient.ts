import { Ollama } from 'ollama';

let ollamaInstance: Ollama | null = null;

export function getOllamaClient(url?: string): Ollama {
  if (ollamaInstance && !url) return ollamaInstance;
  const client = new Ollama({ host: url || 'http://localhost:11434' });
  if (!url) ollamaInstance = client;
  return client;
}

export async function* streamChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  host?: string
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

export async function checkOllamaConnection(host?: string): Promise<{ connected: boolean; models: string[] }> {
  try {
    const ollama = getOllamaClient(host);
    const models = await ollama.list();
    return { connected: true, models: models.models.map((m) => m.name) };
  } catch {
    return { connected: false, models: [] };
  }
}