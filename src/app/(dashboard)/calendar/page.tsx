'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { useCalendarStore } from '@/features/calendar/calendarStore';
import { useBoardStore } from '@/features/board/boardStore';
import CalendarMonthView from '@/components/calendar/CalendarMonthView';
import GanttChartView from '@/components/calendar/GanttChart';

export default function CalendarPage() {
  const { view, currentDate, setView, goToPrevMonth, goToNextMonth } = useCalendarStore();
  const { fetchBoards, fetchAllBoardsData } = useBoardStore();

  useEffect(() => {
    async function load() {
      await fetchBoards();
      await fetchAllBoardsData();
    }
    load();
  }, [fetchBoards, fetchAllBoardsData]);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Calendar</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevMonth}
              className="p-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-[var(--text-secondary)] min-w-[140px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-0.5">
          <button
            onClick={() => setView('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              ${view === 'month'
                ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Month
          </button>
          <button
            onClick={() => setView('gantt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              ${view === 'gantt'
                ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Gantt
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {view === 'month' ? <CalendarMonthView /> : <GanttChartView />}
      </div>
    </div>
  );
}