'use client';

import { useMemo, useState } from 'react';
import {
  format,
  differenceInDays,
  addDays,
  startOfDay,
  isToday,
} from 'date-fns';
import { useCalendarStore } from '@/features/calendar/calendarStore';
import { useBoardStore } from '@/features/board/boardStore';

type ZoomLevel = 'day' | 'week' | 'month';

const ZOOM_WIDTHS: Record<ZoomLevel, number> = {
  day: 40,
  week: 16,
  month: 4,
};

const PRIORITY_COLORS: Record<string, { dot: string; bg: string; bar: string }> = {
  urgent: { dot: '#ef4444', bg: 'bg-red-500/20', bar: 'bg-red-500' },
  high: { dot: '#f97316', bg: 'bg-orange-500/20', bar: 'bg-orange-500' },
  medium: { dot: '#10b981', bg: 'bg-[var(--accent)]/20', bar: 'bg-[var(--accent)]' },
  low: { dot: '#6b7280', bg: 'bg-gray-500/20', bar: 'bg-gray-500' },
};

export default function GanttChart() {
  const { currentDate } = useCalendarStore();
  const { lists, activeBoardId } = useBoardStore();
  const [zoom, setZoom] = useState<ZoomLevel>('week');

  const cards = useMemo(() => {
    const allCards = lists.flatMap((l) => l.cards);
    const filtered = activeBoardId
      ? allCards.filter((c) => c.boardId === activeBoardId)
      : allCards;
    // Only cards with both dates
    return filtered.filter(
      (c) => c.startDate && c.dueDate
    );
  }, [lists, activeBoardId]);

  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      const aStart = new Date(a.startDate!).getTime();
      const bStart = new Date(b.startDate!).getTime();
      return aStart - bStart;
    });
  }, [cards]);

  const { rangeStart, totalDays, dayWidth } = useMemo(() => {
    if (sortedCards.length === 0) {
      const start = startOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
      return {
        rangeStart: start,
        rangeEnd: addDays(start, 30),
        totalDays: 31,
        dayWidth: ZOOM_WIDTHS[zoom],
      };
    }

    let minDate = new Date(sortedCards[0].startDate!);
    let maxDate = new Date(sortedCards[0].dueDate!);

    for (const card of sortedCards) {
      const s = new Date(card.startDate!);
      const e = new Date(card.dueDate!);
      if (s < minDate) minDate = s;
      if (e > maxDate) maxDate = e;
    }

    // Add padding
    const start = addDays(startOfDay(minDate), -3);
    const end = addDays(startOfDay(maxDate), 3);
    const total = differenceInDays(end, start) + 1;

    return {
      rangeStart: start,
      rangeEnd: end,
      totalDays: total,
      dayWidth: ZOOM_WIDTHS[zoom],
    };
  }, [sortedCards, zoom, currentDate]);

  const timelineWidth = totalDays * dayWidth;

  // Generate date headers
  const dateHeaders = useMemo(() => {
    const headers: { date: Date; label: string; isMonthStart: boolean; monthLabel?: string }[] = [];
    let lastMonth = -1;
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(rangeStart, i);
      const month = date.getMonth();
      const isMonthStart = date.getDate() === 1;
      let monthLabel: string | undefined;
      if (isMonthStart || month !== lastMonth) {
        monthLabel = format(date, 'MMM yyyy');
      }
      lastMonth = month;
      headers.push({
        date,
        label: format(date, 'd'),
        isMonthStart,
        monthLabel,
      });
    }
    return headers;
  }, [rangeStart, totalDays]);

  // Today line position
  const todayOffset = useMemo(() => {
    return differenceInDays(new Date(), rangeStart) * dayWidth;
  }, [rangeStart, dayWidth]);

  const showDayLabels = zoom === 'day' || zoom === 'week';

  if (sortedCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center">
          <span className="text-2xl">📊</span>
        </div>
        <p className="text-[var(--text-tertiary)] text-sm">
          No tasks with start and due dates found.
          <br />
          Add dates to your tasks to see them on the Gantt chart.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Zoom controls */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-[var(--text-tertiary)] mr-1">Zoom:</span>
        {(['day', 'week', 'month'] as ZoomLevel[]).map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors
              ${zoom === z
                ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border border-[var(--border)]'
              }`}
          >
            {z.charAt(0).toUpperCase() + z.slice(1)}
          </button>
        ))}
      </div>

      {/* Desktop Gantt chart */}
      <div className="hidden sm:flex flex-1 min-h-0 overflow-hidden border border-[var(--border)] rounded-lg">
        {/* Left panel: task list */}
        <div className="w-56 shrink-0 bg-[var(--bg-elevated)] border-r border-[var(--border)] flex flex-col">
          <div className="h-8 border-b border-[var(--border)] flex items-center px-3">
            <span className="text-xs font-medium text-[var(--text-tertiary)]">Task</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sortedCards.map((card) => {
              const colors = PRIORITY_COLORS[card.priority] || PRIORITY_COLORS.low;
              return (
                <div
                  key={card.id}
                  className="h-10 flex items-center px-3 border-b border-[var(--border)] hover:bg-[var(--bg-base)] transition-colors"
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mr-2 shrink-0"
                    style={{ backgroundColor: colors.dot }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--text-secondary)] truncate">{card.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {card.assignees && card.assignees.length > 0 && (
                        <span className="text-[10px] text-[var(--text-tertiary)]">{card.assignees.map((a: { user: { name: string } }) => a.user.name).join(', ')}</span>
                      )}
                      {card.status && (
                        <span className="text-[10px] text-[var(--text-tertiary)]">{card.status}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel: timeline */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Date header */}
          <div className="h-8 shrink-0 overflow-hidden border-b border-[var(--border)] bg-[var(--bg-elevated)]">
            <div
              className="flex relative"
              style={{ width: timelineWidth }}
            >
              {/* Month labels */}
              {dateHeaders.map((h, i) => {
                if (!h.monthLabel) return null;
                const monthStart = i;
                // Find end of this month section
                let monthEnd = i;
                for (let j = i + 1; j < dateHeaders.length; j++) {
                  if (dateHeaders[j].monthLabel) break;
                  monthEnd = j;
                }
                const width = (monthEnd - monthStart + 1) * dayWidth;
                return (
                  <div
                    key={`month-${i}`}
                    className="absolute top-0 left-0 flex items-center h-4 text-[10px] font-medium text-[var(--text-tertiary)]"
                    style={{
                      left: monthStart * dayWidth,
                      width,
                    }}
                  >
                    {h.monthLabel}
                  </div>
                );
              })}
              {/* Day numbers */}
              <div className="flex mt-4">
                {dateHeaders.map((h, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-center text-[10px] shrink-0
                      ${isToday(h.date) ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-tertiary)]'}`}
                    style={{ width: dayWidth }}
                  >
                    {showDayLabels ? h.label : (i % 7 === 0 ? h.label : '')}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bars area */}
          <div className="flex-1 overflow-auto">
            <div
              className="relative"
              style={{ width: timelineWidth, minHeight: sortedCards.length * 40 }}
            >
              {/* Grid lines */}
              {dateHeaders.map((_, i) => (
                <div
                  key={`grid-${i}`}
                  className="absolute top-0 bottom-0 border-l border-[var(--border)] opacity-30"
                  style={{ left: i * dayWidth }}
                />
              ))}

              {/* Today line */}
              {todayOffset >= 0 && todayOffset <= timelineWidth && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[var(--accent)] z-10"
                  style={{ left: todayOffset }}
                >
                  <div className="absolute -top-0 left-1/2 -translate-x-1/2 text-[9px] font-bold text-[var(--accent)] bg-[var(--bg-base)] px-1 rounded">
                    Today
                  </div>
                </div>
              )}

              {/* Task bars */}
              {sortedCards.map((card, index) => {
                const start = new Date(card.startDate!);
                const end = new Date(card.dueDate!);
                const offsetDays = differenceInDays(start, rangeStart);
                const durationDays = Math.max(differenceInDays(end, start), 1);
                const left = offsetDays * dayWidth;
                const width = durationDays * dayWidth;
                const colors = PRIORITY_COLORS[card.priority] || PRIORITY_COLORS.low;

                return (
                  <div
                    key={card.id}
                    className="absolute flex items-center"
                    style={{ top: index * 40, height: 40, left: 0, width: timelineWidth }}
                  >
                    <div
                      className={`absolute rounded ${colors.bg} ${colors.bar} h-6 flex items-center overflow-hidden group cursor-pointer transition-opacity hover:opacity-90`}
                      style={{
                        left,
                        width: Math.max(width, dayWidth),
                      }}
                    >
                      {/* Progress fill */}
                      <div
                        className="absolute inset-y-0 left-0 rounded opacity-30 bg-white"
                        style={{ width: `${card.progress}%` }}
                      />
                      {/* Label */}
                      {width > 60 && (
                        <span className="relative z-10 text-[11px] text-[var(--text-primary)] font-medium truncate px-2">
                          {card.title}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile list view */}
      <div className="sm:hidden flex-1 overflow-y-auto space-y-2">
        {sortedCards.map((card) => {
          const colors = PRIORITY_COLORS[card.priority] || PRIORITY_COLORS.low;
          return (
            <div key={card.id} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: colors.dot }}
                />
                <span className="text-sm text-[var(--text-secondary)] truncate">{card.title}</span>
              </div>
              {card.startDate && card.dueDate && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {format(new Date(card.startDate), 'MMM d')} – {format(new Date(card.dueDate), 'MMM d')}
                </p>
              )}
              {card.progress > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${card.progress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}