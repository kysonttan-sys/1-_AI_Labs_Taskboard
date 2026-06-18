'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, BarChart3, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useCalendarStore } from '@/features/calendar/calendarStore';
import { useBoardStore } from '@/features/board/boardStore';
import { useOkrStore } from '@/features/okrs/okrStore';
import CalendarMonthView from '@/components/calendar/CalendarMonthView';
import GanttChartView from '@/components/calendar/GanttChart';
import TeamMeeting from '@/components/meeting/TeamMeeting';

export default function CalendarPage() {
  const { view, currentDate, setView, goToPrevMonth, goToNextMonth, fetchEvents } = useCalendarStore();
  const { fetchBoards, fetchAllBoardsData } = useBoardStore();
  const { objectives, fetchObjectives } = useOkrStore();

  useEffect(() => {
    async function load() {
      await fetchBoards();
      await fetchAllBoardsData();
      await fetchObjectives();
      await fetchEvents(currentDate);
    }
    load();
  }, [fetchBoards, fetchAllBoardsData, fetchObjectives, fetchEvents, currentDate]);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Calendar</h1>
          {view !== 'meeting' && (
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
          )}
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
          <button
            onClick={() => setView('meeting')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              ${view === 'meeting'
                ? 'bg-[var(--accent)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
          >
            <Users className="h-3.5 w-3.5" />
            Meeting
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {view === 'month' && <CalendarMonthView />}
        {view === 'gantt' && <GanttChartView objectives={objectives} />}
        {view === 'meeting' && <TeamMeeting />}
      </div>
    </div>
  );
}
