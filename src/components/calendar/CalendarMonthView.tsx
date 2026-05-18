'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  addDays,
  format,
} from 'date-fns';
import { X, Plus } from 'lucide-react';
import { useCalendarStore } from '@/features/calendar/calendarStore';
import { useBoardStore } from '@/features/board/boardStore';
import { useAuthStore } from '@/features/auth/authStore';
import EventModal from './EventModal';
import type { CalendarEvent } from '@/types';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-500',
};

interface GoogleEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  description: string | null;
  location: string | null;
}

export default function CalendarMonthView() {
  const { currentDate, selectedDate, setSelectedDate, events, fetchEvents } = useCalendarStore();
  const { lists, activeBoardId } = useBoardStore();
  const currentUser = useAuthStore((s) => s.user);
  const [panelOpen, setPanelOpen] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  useEffect(() => {
    fetchEvents(currentDate);
  }, [currentDate, fetchEvents]);

  useEffect(() => {
    async function fetchGoogleEvents() {
      try {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const res = await fetch(
          `/api/calendar/google?timeMin=${monthStart.toISOString()}&timeMax=${monthEnd.toISOString()}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.connected) {
          setGoogleEvents(data.events || []);
        }
      } catch {
        // Google Calendar not connected or failed
      }
    }
    fetchGoogleEvents();
  }, [currentDate]);

  const cards = useMemo(() => {
    const allCards = lists.flatMap((l) => l.cards);
    if (activeBoardId) {
      return allCards.filter((c) => c.boardId === activeBoardId);
    }
    return allCards;
  }, [lists, activeBoardId]);

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const monthDays = eachDayOfInterval({ start, end });

    const startDay = start.getDay();
    const prefix: Date[] = [];
    for (let i = 0; i < startDay; i++) {
      prefix.push(addDays(start, -(startDay - i)));
    }

    const endDay = end.getDay();
    const suffix: Date[] = [];
    for (let i = 1; i < 7 - endDay; i++) {
      suffix.push(addDays(end, i));
    }

    return [...prefix, ...monthDays, ...suffix];
  }, [currentDate]);

  const cardsByDate = useMemo(() => {
    const map = new Map<string, typeof cards>();
    for (const card of cards) {
      if (!card.dueDate) continue;
      const key = format(new Date(card.dueDate), 'yyyy-MM-dd');
      const existing = map.get(key) ?? [];
      existing.push(card);
      map.set(key, existing);
    }
    return map;
  }, [cards]);

  const selectedCards = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return cardsByDate.get(key) ?? [];
  }, [selectedDate, cardsByDate]);

  const localEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      // For all-day events, extract date from ISO string to avoid timezone shifts
      const startKey = event.allDay ? event.startDate.slice(0, 10) : format(new Date(event.startDate), 'yyyy-MM-dd');
      const endKey = event.endDate
        ? (event.allDay ? event.endDate.slice(0, 10) : format(new Date(event.endDate), 'yyyy-MM-dd'))
        : startKey;
      const current = new Date(startKey + 'T00:00:00');
      const end = new Date(endKey + 'T00:00:00');
      while (current <= end) {
        const key = format(current, 'yyyy-MM-dd');
        const existing = map.get(key) ?? [];
        existing.push(event);
        map.set(key, existing);
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  }, [events]);

  const selectedLocalEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return localEventsByDate.get(key) ?? [];
  }, [selectedDate, localEventsByDate]);

  const googleEventsByDate = useMemo(() => {
    const map = new Map<string, GoogleEvent[]>();
    for (const event of googleEvents) {
      if (!event.start) continue;
      const dateStr = format(new Date(event.start), 'yyyy-MM-dd');
      const existing = map.get(dateStr) ?? [];
      existing.push(event);
      map.set(dateStr, existing);
    }
    return map;
  }, [googleEvents]);

  const selectedGoogleEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, 'yyyy-MM-dd');
    return googleEventsByDate.get(key) ?? [];
  }, [selectedDate, googleEventsByDate]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleEventSave = useCallback(() => {
    setEditingEvent(null);
    setIsCreatingEvent(false);
    fetchEvents(currentDate);
  }, [currentDate, fetchEvents]);

  const handleEventDelete = useCallback(() => {
    setEditingEvent(null);
    fetchEvents(currentDate);
  }, [currentDate, fetchEvents]);

  const hasSelectedContent = selectedCards.length > 0 || selectedLocalEvents.length > 0 || selectedGoogleEvents.length > 0;

  return (
    <div className="flex flex-1 gap-4 h-full min-h-0">
      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-[var(--border)]">
          {weekDays.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {days.map((day, i) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayCards = cardsByDate.get(key) ?? [];
            const dayLocalEvents = localEventsByDate.get(key) ?? [];
            const dayGoogleEvents = googleEventsByDate.get(key) ?? [];
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

            return (
              <div
                key={i}
                onClick={() => {
                  setSelectedDate(day);
                  setPanelOpen(true);
                }}
                className={`border border-[var(--border)] p-0.5 sm:p-1.5 cursor-pointer transition-colors
                  ${inMonth ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-base)]'}
                  ${isSelected ? 'ring-1 ring-emerald-500' : ''}
                  hover:bg-[var(--bg-card-hover,#222226)]`}
              >
                <span
                  className={`text-[10px] sm:text-xs font-medium inline-flex items-center justify-center h-5 sm:h-6 w-5 sm:w-6 rounded-full
                    ${today ? 'bg-emerald-500 text-white' : ''}
                    ${!today && inMonth ? 'text-gray-300' : ''}
                    ${!inMonth ? 'text-gray-600' : ''}`}
                >
                  {format(day, 'd')}
                </span>

                {/* Task & event labels */}
                <div className="mt-1 space-y-0.5 overflow-hidden">
                  {dayCards.slice(0, 5).map((card) => (
                    <div
                      key={card.id}
                      className={`px-1 py-0.5 rounded text-[9px] leading-tight truncate ${
                        card.priority === 'urgent' ? 'bg-red-500/20 text-red-300' :
                        card.priority === 'high' ? 'bg-orange-500/20 text-orange-300' :
                        card.priority === 'medium' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-gray-500/20 text-gray-400'
                      }`}
                      title={card.title}
                    >
                      {card.title}
                    </div>
                  ))}
                  {dayLocalEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className="px-1 py-0.5 rounded text-[9px] leading-tight truncate"
                      style={{ backgroundColor: event.color + '22', color: event.color }}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayGoogleEvents.slice(0, 1).map((event) => (
                    <div
                      key={event.id}
                      className="px-1 py-0.5 rounded text-[9px] leading-tight truncate bg-cyan-500/15 text-cyan-300"
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {((dayCards.length + dayLocalEvents.length + dayGoogleEvents.length) > 8) && (
                    <span className="text-[9px] text-gray-500">
                      +{dayCards.length + dayLocalEvents.length + dayGoogleEvents.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side panel for selected day */}
      {panelOpen && selectedDate && (
        <div className="hidden sm:flex w-72 shrink-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-medium text-white">
              {format(selectedDate, 'EEEE, MMM d')}
            </h3>
            <button
              onClick={() => {
                setPanelOpen(false);
                setSelectedDate(null);
              }}
              className="p-1 rounded hover:bg-[var(--bg-base)] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Add event button */}
            <button
              onClick={() => setIsCreatingEvent(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 mb-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add event
            </button>

            {!hasSelectedContent ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No tasks or events on this day
              </p>
            ) : (
              <>
                {/* Tasks */}
                {selectedCards.map((card) => (
                  <div
                    key={card.id}
                    className="p-2.5 rounded-md bg-[var(--bg-base)] border border-[var(--border)]"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_COLORS[card.priority] || 'bg-gray-500'}`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-200 truncate">{card.title}</p>
                        {card.assignees && card.assignees.length > 0 && (
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {card.assignees.map((a: { user: { name: string } }) => a.user.name).join(', ')}
                          </p>
                        )}
                        {card.progress > 0 && (
                          <div className="mt-1.5 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${card.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Local events */}
                {selectedLocalEvents.length > 0 && (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <p className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide mb-2">Events</p>
                    {selectedLocalEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => { if (event.userId === currentUser?.id) setEditingEvent(event); }}
                        className={`p-2.5 rounded-md bg-[var(--bg-base)] border border-transparent hover:border-[var(--border)] transition-colors mb-2 ${event.userId === currentUser?.id ? 'cursor-pointer' : 'cursor-default'}`}
                        style={{ borderLeftWidth: '3px', borderLeftColor: event.color }}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-200 truncate">{event.title}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {event.allDay ? 'All day' : new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              {event.visibility === 'team' && event.user && event.userId !== currentUser?.id && (
                                <span className="ml-1 text-gray-600">by {event.user.name}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Google Calendar events */}
                {selectedGoogleEvents.length > 0 && (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <p className="text-[10px] font-medium text-cyan-400 uppercase tracking-wide mb-2">Google Calendar</p>
                    {selectedGoogleEvents.map((event) => (
                      <div
                        key={event.id}
                        className="p-2.5 rounded-md bg-[var(--bg-base)] border border-cyan-500/20 mb-2"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 h-2 w-2 rounded-full shrink-0 bg-cyan-400" />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-200 truncate">{event.title}</p>
                            <p className="text-[11px] text-cyan-400/70 mt-0.5">
                              {event.isAllDay ? 'All day' : `${new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                            </p>
                            {event.location && (
                              <p className="text-[10px] text-gray-500 mt-0.5 truncate">{event.location}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile overlay for selected day */}
      {panelOpen && selectedDate && (
        <div className="fixed inset-0 z-50 sm:hidden flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setPanelOpen(false); setSelectedDate(null); }} />
          <div className="relative w-full max-h-[70vh] bg-[var(--bg-card)] border-t border-[var(--border)] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
              <h3 className="text-sm font-medium text-white">
                {format(selectedDate, 'EEEE, MMM d')}
              </h3>
              <button
                onClick={() => { setPanelOpen(false); setSelectedDate(null); }}
                className="p-1 rounded hover:bg-[var(--bg-base)] text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Add event button */}
              <button
                onClick={() => setIsCreatingEvent(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 mb-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add event
              </button>

              {!hasSelectedContent ? (
                <p className="text-xs text-gray-500 text-center py-4">
                  No tasks or events on this day
                </p>
              ) : (
                <>
                  {selectedCards.map((card) => (
                    <div
                      key={card.id}
                      className="p-2.5 rounded-md bg-[var(--bg-base)] border border-[var(--border)]"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_COLORS[card.priority] || 'bg-gray-500'}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-200 truncate">{card.title}</p>
                          {card.assignees && card.assignees.length > 0 && (
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {card.assignees.map((a: { user: { name: string } }) => a.user.name).join(', ')}
                            </p>
                          )}
                          {card.progress > 0 && (
                            <div className="mt-1.5 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${card.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedLocalEvents.length > 0 && (
                    <div className="pt-2 border-t border-[var(--border)]">
                      <p className="text-[10px] font-medium text-emerald-400 uppercase tracking-wide mb-2">Events</p>
                      {selectedLocalEvents.map((event) => (
                        <div
                          key={event.id}
                          onClick={() => { if (event.userId === currentUser?.id) setEditingEvent(event); }}
                          className={`p-2.5 rounded-md bg-[var(--bg-base)] border border-transparent hover:border-[var(--border)] transition-colors mb-2 ${event.userId === currentUser?.id ? 'cursor-pointer' : 'cursor-default'}`}
                          style={{ borderLeftWidth: '3px', borderLeftColor: event.color }}
                        >
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                            <div className="min-w-0">
                              <p className="text-sm text-gray-200 truncate">{event.title}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {event.allDay ? 'All day' : new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                {event.visibility === 'team' && event.user && event.userId !== currentUser?.id && (
                                  <span className="ml-1 text-gray-600">by {event.user.name}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedGoogleEvents.length > 0 && (
                    <div className="pt-2 border-t border-[var(--border)]">
                      <p className="text-[10px] font-medium text-cyan-400 uppercase tracking-wide mb-2">Google Calendar</p>
                      {selectedGoogleEvents.map((event) => (
                        <div
                          key={event.id}
                          className="p-2.5 rounded-md bg-[var(--bg-base)] border border-cyan-500/20 mb-2"
                        >
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 h-2 w-2 rounded-full shrink-0 bg-cyan-400" />
                            <div className="min-w-0">
                              <p className="text-sm text-gray-200 truncate">{event.title}</p>
                              <p className="text-[11px] text-cyan-400/70 mt-0.5">
                                {event.isAllDay ? 'All day' : `${new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {(isCreatingEvent || editingEvent) && (
        <EventModal
          event={editingEvent ?? undefined}
          defaultDate={selectedDate ?? undefined}
          onClose={() => { setEditingEvent(null); setIsCreatingEvent(false); }}
          onSave={handleEventSave}
          onDelete={handleEventDelete}
        />
      )}
    </div>
  );
}