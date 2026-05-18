'use client';

import { useState } from 'react';
import { Sparkles, Loader2, User, Clock, AlertTriangle, Check } from 'lucide-react';
import { useBoardStore } from '@/features/board/boardStore';

interface AssignmentSuggestion {
  type: 'assignment';
  cardTitle: string;
  suggestedAssignee: string;
  reason: string;
  confidence: number;
}

interface DurationSuggestion {
  type: 'duration';
  cardTitle: string;
  estimatedDays: number;
  reason: string;
  confidence: number;
}

interface BottleneckSuggestion {
  type: 'bottleneck';
  description: string;
  affectedCards: string[];
  suggestion: string;
}

type Suggestion = AssignmentSuggestion | DurationSuggestion | BottleneckSuggestion;

export default function AISuggestionPanel() {
  const { updateCard, activeBoardId } = useBoardStore();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());

  const fetchSuggestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: activeBoardId }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyAssignment = async (suggestion: AssignmentSuggestion, index: number) => {
    const { lists } = useBoardStore.getState();
    const card = lists.flatMap(l => l.cards).find(c => c.title === suggestion.cardTitle);
    if (card) {
      const users = await fetch('/api/users').then(r => r.json());
      const matchedUser = users.find((u: { name: string }) =>
        u.name.toLowerCase() === suggestion.suggestedAssignee.toLowerCase()
      );
      if (matchedUser) {
        const currentIds = card.assignees?.map((a: { user: { id: string } }) => a.user.id) ?? [];
        await updateCard(card.id, { assigneeIds: [...currentIds, matchedUser.id] });
        setAppliedIndices(prev => new Set(prev).add(index));
      }
    }
  };

  const getIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'assignment':
        return <User className="h-4 w-4 text-blue-400" />;
      case 'duration':
        return <Clock className="h-4 w-4 text-amber-400" />;
      case 'bottleneck':
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
    }
  };

  const getBorderColor = (type: Suggestion['type']) => {
    switch (type) {
      case 'assignment':
        return 'border-blue-500/30';
      case 'duration':
        return 'border-amber-500/30';
      case 'bottleneck':
        return 'border-red-500/30';
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          AI Suggestions
        </h3>
        <button
          onClick={fetchSuggestions}
          disabled={isLoading}
          className="px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              Get Suggestions
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {suggestions.length === 0 && !isLoading && !error && (
        <div className="text-center py-8">
          <Sparkles className="h-8 w-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Click &ldquo;Get Suggestions&rdquo; to analyze your board
          </p>
        </div>
      )}

      <div className="space-y-3">
        {suggestions.map((suggestion, i) => {
          const isApplied = appliedIndices.has(i);

          return (
            <div
              key={i}
              className={`p-3 rounded-lg bg-[var(--bg-base)] border ${getBorderColor(suggestion.type)} space-y-1.5`}
            >
              <div className="flex items-start gap-2">
                {getIcon(suggestion.type)}
                <div className="flex-1 min-w-0">
                  {suggestion.type === 'assignment' && (
                    <>
                      <p className="text-xs font-medium text-gray-200">{suggestion.cardTitle}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Suggested assignee: <span className="text-blue-400">{suggestion.suggestedAssignee}</span>
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{suggestion.reason}</p>
                      {!isApplied && (
                        <button
                          onClick={() => handleApplyAssignment(suggestion, i)}
                          className="mt-1.5 px-2 py-1 text-[10px] font-medium bg-emerald-500 hover:bg-emerald-400 text-white rounded transition-colors"
                        >
                          Apply
                        </button>
                      )}
                      {isApplied && (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-400">
                          <Check className="h-3 w-3" /> Applied
                        </span>
                      )}
                    </>
                  )}
                  {suggestion.type === 'duration' && (
                    <>
                      <p className="text-xs font-medium text-gray-200">{suggestion.cardTitle}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Estimated: <span className="text-amber-400">{suggestion.estimatedDays} days</span>
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{suggestion.reason}</p>
                      <span className="text-[10px] text-gray-600">
                        Confidence: {getConfidenceLabel(suggestion.confidence)}
                      </span>
                    </>
                  )}
                  {suggestion.type === 'bottleneck' && (
                    <>
                      <p className="text-xs font-medium text-gray-200">{suggestion.description}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">Suggestion: {suggestion.suggestion}</p>
                      {suggestion.affectedCards.length > 0 && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Affected: {suggestion.affectedCards.join(', ')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}