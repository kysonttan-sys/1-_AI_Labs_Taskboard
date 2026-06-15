'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import {
  format,
  differenceInDays,
  addDays,
  startOfDay,
  isToday,
} from 'date-fns';
import { useCalendarStore } from '@/features/calendar/calendarStore';
import { useBoardStore } from '@/features/board/boardStore';
import { useOkrStore } from '@/features/okrs/okrStore';
import { Briefcase, Target } from 'lucide-react';
import type { Objective } from '@/lib/api/okrs';

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

interface GanttItem {
  id: string;
  type: 'card' | 'objective';
  title: string;
  startDate: string;
  endDate: string;
  meta: {
    priority?: string;
    assignees?: { user: { name: string } }[];
    status?: string;
    progress?: number;
  };
}

interface Props {
  objectives?: Objective[];
}

export default function GanttChart({ objectives = [] }: Props) {
  const { currentDate } = useCalendarStore();
  const { lists, activeBoardId } = useBoardStore();
  const { updateObjective } = useOkrStore();
  const { updateCard } = useBoardStore();
  const [zoom, setZoom] = useState<ZoomLevel>('week');

  const [dragging, setDragging] = useState<{
    id: string;
    type: 'card' | 'objective';
    startX: number;
    originalStart: Date;
    originalEnd: Date;
    dayWidth: number;
  } | null>(null);

  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const cards = useMemo(() => {
    const allCards = lists.flatMap((l) => l.cards);
    const filtered = activeBoardId
      ? allCards.filter((c) => c.boardId === activeBoardId)
      : allCards;
    return filtered.filter(
      (c) => c.startDate && c.dueDate && c.status !== 'done'
    );
  }, [lists, activeBoardId]);

  const items: GanttItem[] = useMemo(() => {
    const cardItems: GanttItem[] = cards.map((c) => ({
      id: c.id,
      type: 'card',
      title: c.title,
      startDate: c.startDate!,
      endDate: c.dueDate!,
      meta: {
        priority: c.priority,
        assignees: c.assignees,
        status: c.status,
        progress: c.progress,
      },
    }));

    const objectiveItems: GanttItem[] = objectives.map((o) => ({
      id: o.id,
      type: 'objective',
      title: o.title,
      startDate: o.startDate,
      endDate: o.endDate,
      meta: {},
    }));

    return [...objectiveItems, ...cardItems].sort((a, b) => {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  }, [cards, objectives]);

  const { rangeStart, totalDays, dayWidth } = useMemo(() => {
    if (items.length === 0) {
      const start = startOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
      return {
        rangeStart: start,
        rangeEnd: addDays(start, 30),
        totalDays: 31,
        dayWidth: ZOOM_WIDTHS[zoom],
      };
    }

    let minDate = new Date(items[0].startDate);
    let maxDate = new Date(items[0].endDate);

    for (const item of items) {
      const s = new Date(item.startDate);
      const e = new Date(item.endDate);
      if (s < minDate) minDate = s;
      if (e > maxDate) maxDate = e;
    }

    const start = addDays(startOfDay(minDate), -3);
    const end = addDays(startOfDay(maxDate), 3);
    const total = differenceInDays(end, start) + 1;

    return {
      rangeStart: start,
      rangeEnd: end,
      totalDays: total,
      dayWidth: ZOOM_WIDTHS[zoom],
    };
  }, [items, zoom, currentDate]);

  const timelineWidth = totalDays * dayWidth;

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

  const todayOffset = useMemo(() => {
    return differenceInDays(new Date(), rangeStart) * dayWidth;
  }, [rangeStart, dayWidth]);

  const showDayLabels = zoom === 'day' || zoom === 'week';

  const handleMouseDown = useCallback((e: React.MouseEvent, item: GanttItem) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    setDragging({
      id: item.id,
      type: item.type,
      startX: e.clientX,
      originalStart: new Date(item.startDate),
      originalEnd: new Date(item.endDate),
      dayWidth,
    });
    setDragOffset(0);
  }, [dayWidth]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const deltaPixels = e.clientX - dragging.startX;
    setDragOffset(deltaPixels);
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    if (!dragging) return;
    const deltaDays = Math.round(dragOffset / dragging.dayWidth);
    if (deltaDays !== 0) {
      const newStart = addDays(dragging.originalStart, deltaDays);
      const newEnd = addDays(dragging.originalEnd, deltaDays);
      if (dragging.type === 'objective') {
        updateObjective(dragging.id, {
          startDate: newStart.toISOString(),
          endDate: newEnd.toISOString(),
        });
      } else {
        updateCard(dragging.id, {
          startDate: newStart.toISOString(),
          dueDate: newEnd.toISOString(),
        });
      }
    }
    setDragging(null);
    setDragOffset(0);
  }, [dragging, dragOffset, updateObjective, updateCard]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center">
          <span className="text-2xl">📊</span>
        </div>
        <p className="text-[var(--text-tertiary)] text-sm">
          No tasks or objectives with dates found.
          <br />
          Add dates to your tasks and objectives to see them on the Gantt chart.
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
            <span className="text-xs font-medium text-[var(--text-tertiary)]">Task / Objective</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {items.map((item) => {
              const colors = item.type === 'card' ? PRIORITY_COLORS[item.meta.priority || 'low'] || PRIORITY_COLORS.low : null;
              return (
                <div
                  key={item.id}
                  className="h-10 flex items-center px-3 border-b border-[var(--border)] hover:bg-[var(--bg-base)] transition-colors"
                >
                  {item.type === 'objective' ? (
                    <Target className="h-3.5 w-3.5 mr-2 shrink-0 text-[var(--accent)]" />
                  ) : (
                    <div
                      className="w-1.5 h-1.5 rounded-full mr-2 shrink-0"
                      style={{ backgroundColor: colors?.dot }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--text-secondary)] truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.type === 'card' && item.meta.assignees && item.meta.assignees.length > 0 && (
                        <span className="text-[10px] text-[var(--text-tertiary)]">{item.meta.assignees.map((a: { user: { name: string } }) => a.user.name).join(', ')}</span>
                      )}
                      {item.type === 'card' && item.meta.status && (
                        <span className="text-[10px] text-[var(--text-tertiary)]">{item.meta.status}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel: timeline */}
        <div
          className="flex-1 flex flex-col min-w-0 overflow-hidden"
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Date header */}
          <div className="h-8 shrink-0 overflow-hidden border-b border-[var(--border)] bg-[var(--bg-elevated)]">
            <div
              className="flex relative"
              style={{ width: timelineWidth }}
            >
              {/* Month labels */}
              {dateHeaders.map((h, i) => {
                if (!h.monthLabel) return null;
                let monthEnd = i;
                for (let j = i + 1; j < dateHeaders.length; j++) {
                  if (dateHeaders[j].monthLabel) break;
                  monthEnd = j;
                }
                const width = (monthEnd - i + 1) * dayWidth;
                return (
                  <div
                    key={`month-${i}`}
                    className="absolute top-0 left-0 flex items-center h-4 text-[10px] font-medium text-[var(--text-tertiary)]"
                    style={{
                      left: i * dayWidth,
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
              style={{ width: timelineWidth, minHeight: items.length * 40 }}
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
              {items.map((item, index) => {
                const start = new Date(item.startDate);
                const end = new Date(item.endDate);
                const offsetDays = differenceInDays(start, rangeStart);
                const durationDays = Math.max(differenceInDays(end, start), 1);
                const left = offsetDays * dayWidth;
                const width = durationDays * dayWidth;

                const isDragging = dragging?.id === item.id;
                const visualLeft = left + (isDragging ? dragOffset : 0);

                const isObjective = item.type === 'objective';
                const colors = isObjective
                  ? { bg: 'bg-purple-500/20', bar: 'bg-purple-500' }
                  : PRIORITY_COLORS[item.meta.priority || 'low'] || PRIORITY_COLORS.low;

                return (
                  <div
                    key={item.id}
                    className="absolute flex items-center"
                    style={{ top: index * 40, height: 40, left: 0, width: timelineWidth }}
                  >
                    <div
                      onMouseDown={(e) => handleMouseDown(e, item)}
                      className={`absolute rounded ${colors.bg} ${colors.bar} h-6 flex items-center overflow-hidden group cursor-grab active:cursor-grabbing transition-opacity hover:opacity-90 ${isDragging ? 'opacity-80 z-20' : ''}`}
                      style={{
                        left: visualLeft,
                        width: Math.max(width, dayWidth),
                      }}
                      title={`${item.title}: ${format(start, 'MMM d')} – ${format(end, 'MMM d')}${isObjective ? ' (OKR)' : ''}`}
                    >
                      {!isObjective && item.meta.progress !== undefined && (
                        <div
                          className="absolute inset-y-0 left-0 rounded opacity-30 bg-white"
                          style={{ width: `${item.meta.progress}%` }}
                        />
                      )}
                      {width > 60 && (
                        <span className="relative z-10 text-[11px] text-[var(--text-primary)] font-medium truncate px-2 flex items-center gap-1">
                          {isObjective && <Briefcase className="h-3 w-3" />}
                          {item.title}
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
        {items.map((item) => {
          const isObjective = item.type === 'objective';
          const colors = isObjective
            ? { dot: '#a855f7', bg: 'bg-purple-500/20', bar: 'bg-purple-500' }
            : PRIORITY_COLORS[item.meta.priority || 'low'] || PRIORITY_COLORS.low;
          return (
            <div key={item.id} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: colors.dot }}
                />
                <span className="text-sm text-[var(--text-secondary)] truncate">{item.title}</span>
                {isObjective && <span className="text-[10px] text-purple-400 font-medium">OKR</span>}
              </div>
              {item.startDate && item.endDate && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {format(new Date(item.startDate), 'MMM d')} – {format(new Date(item.endDate), 'MMM d')}
                </p>
              )}
              {!isObjective && item.meta.progress !== undefined && item.meta.progress > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${item.meta.progress}%` }}
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
