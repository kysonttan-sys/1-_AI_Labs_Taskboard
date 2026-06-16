'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import ActivityRow from './ActivityRow';

interface Props {
  boardId?: string;
  showBoard?: boolean;
  limit?: number;
}

export default function ActivityFeed({ boardId, showBoard, limit = 50 }: Props) {
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
    <div className="card-base p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Activity</h2>
      </div>
      {isLoading ? (
        <p className="text-xs text-[var(--text-tertiary)]">Loading...</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)]">No activity yet.</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {events.map((event) => (
            <ActivityRow key={event.id} event={event} showBoard={showBoard} />
          ))}
        </div>
      )}
    </div>
  );
}
