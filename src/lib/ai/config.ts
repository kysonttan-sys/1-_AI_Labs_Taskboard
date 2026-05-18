export function isAIEnabled(): boolean {
  return process.env.OLLAMA_ENABLED !== 'false';
}