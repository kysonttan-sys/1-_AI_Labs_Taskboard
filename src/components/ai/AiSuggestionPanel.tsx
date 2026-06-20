'use client';

import { useState } from 'react';
import { useAiSuggestion, type PromptType } from '@/features/ai/useAiSuggestion';
import { Sparkles, Bot, RefreshCw, X, Loader2, Lightbulb, Target, ListTodo, AlertTriangle, Footprints } from 'lucide-react';

interface AiSuggestionPanelProps {
  projectId?: string;
  className?: string;
}

const ACTIONS: { key: PromptType; label: string; icon: React.ReactNode; defaultForProject?: boolean }[] = [
  { key: 'focus', label: 'What to focus on', icon: <Target className="h-3.5 w-3.5" /> },
  { key: 'suggest-tasks', label: 'Suggest tasks', icon: <ListTodo className="h-3.5 w-3.5" /> },
  { key: 'suggest-okrs', label: 'Suggest OKRs', icon: <Footprints className="h-3.5 w-3.5" /> },
  { key: 'missing-steps', label: 'Missing steps', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { key: 'project-next-steps', label: 'Next steps', icon: <Lightbulb className="h-3.5 w-3.5" />, defaultForProject: true },
];

export default function AiSuggestionPanel({ projectId, className = '' }: AiSuggestionPanelProps) {
  const { suggestion, loading, error, ask, reset } = useAiSuggestion();
  const [activeKey, setActiveKey] = useState<PromptType | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handleAction = async (promptType: PromptType) => {
    setActiveKey(promptType);
    await ask({ promptType, projectId });
  };

  return (
    <div className={`card-base overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--accent)]/10 text-[var(--accent)]">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI assistant</h3>
            <p className="text-xs text-[var(--text-tertiary)]">
              Powered by your local Ollama via Tailscale Funnel
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(suggestion || error) && (
            <button
              onClick={reset}
              className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
              aria-label="Clear suggestion"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
            aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((action) => {
              if (projectId && action.key === 'focus') return null;
              return (
                <button
                  key={action.key}
                  onClick={() => handleAction(action.key)}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border
                    ${activeKey === action.key && loading
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)]'
                    } disabled:opacity-60`}
                >
                  {action.icon}
                  {action.label}
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" />
              Asking your local Ollama...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">AI assistant unavailable</p>
                  <p className="text-red-300/80">{error}</p>
                </div>
              </div>
            </div>
          )}

          {suggestion && !loading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                <Sparkles className="h-3 w-3" />
                Suggestion
              </div>
              <div className="bg-[var(--bg-surface)] rounded-md p-3 text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {suggestion}
              </div>
              <button
                onClick={() => activeKey && handleAction(activeKey)}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline disabled:opacity-60"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate
              </button>
            </div>
          )}

          {!suggestion && !error && !loading && (
            <p className="text-xs text-[var(--text-tertiary)]">
              Pick a suggestion above. The AI reads your tasks and OKRs to give advice. Add project context in the
              “Project context for AI” section to improve results.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
