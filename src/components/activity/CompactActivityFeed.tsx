'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import ActivityRow from './ActivityRow';

interface Props {
  boardId?: string;
  limit?: number;
}

export default function CompactActivityFeed({ boardId, limit = 30 }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const url = boardId
      ? `/api/boards/${boardId}/activity?limit=${limit}`
      : `/api/activity?limit=${limit}`;
    setIsLoading(true);
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data.events ?? []);
      })
      .catch(() => setEvents([]))
      .finally(() => setIsLoading(false));
  }, [boardId, limit]);

  return (
    <div className="flex flex-col h-full">
      {isLoading ? (
        <p className="text-xs text-[var(--text-tertiary)] px-4 py-3">Loading activity...</p>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)]">
          <Activity className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">No activity yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="divide-y divide-[var(--border)]">
            {events.map((event) => (
              <div
                key={event.id}
                className="px-4 py-2.5 hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                onClick={() => {
                  if (event.boardId) {
                    window.location.href = event.cardId
                      ? `/board/${event.boardId}?card=${event.cardId}`
                      : `/board/${event.boardId}`;
                  }
                }}
              >
                <ActivityRow event={event} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
