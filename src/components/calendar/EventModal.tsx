'use client';

import { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { CalendarEvent } from '@/types';

const EVENT_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#ec4899', // pink
  '#06b6d4', // cyan
];

interface EventModalProps {
  event?: CalendarEvent;
  defaultDate?: Date;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}

export default function EventModal({ event, defaultDate, onClose, onSave, onDelete }: EventModalProps) {
  const isEditing = !!event;

  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  // For all-day events, extract the date directly from the ISO string to avoid timezone shifts
  const [startDate, setStartDate] = useState(
    event?.startDate
      ? (event.allDay ? event.startDate.slice(0, 10) : format(new Date(event.startDate), 'yyyy-MM-dd'))
      : defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [startTime, setStartTime] = useState(
    event?.startDate && !event.allDay ? format(new Date(event.startDate), 'HH:mm') : '09:00'
  );
  const [endDate, setEndDate] = useState(
    event?.endDate
      ? (event.allDay ? event.endDate.slice(0, 10) : format(new Date(event.endDate), 'yyyy-MM-dd'))
      : ''
  );
  const [endTime, setEndTime] = useState(
    event?.endDate && !event.allDay ? format(new Date(event.endDate), 'HH:mm') : '10:00'
  );
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [color, setColor] = useState(event?.color ?? '#10b981');
  const [visibility, setVisibility] = useState(event?.visibility ?? 'private');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function formatDateTime(dateStr: string, timeStr: string, isAllDay: boolean): string {
    if (isAllDay) return `${dateStr}T00:00:00.000Z`;
    // Create a Date from local time inputs, then convert to proper UTC ISO string
    const localDate = new Date(`${dateStr}T${timeStr}:00`);
    return localDate.toISOString();
  }

  async function handleSave() {
    if (!title.trim() || !startDate) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      startDate: formatDateTime(startDate, startTime, allDay),
      allDay,
      color,
      visibility,
    };

    if (!allDay && endDate) {
      payload.endDate = formatDateTime(endDate, endTime, allDay);
    } else if (allDay && endDate) {
      payload.endDate = formatDateTime(endDate, '00:00', true);
    } else {
      payload.endDate = null;
    }

    try {
      let res: Response;
      if (isEditing && event) {
        res = await fetch(`/api/events/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      if (res.ok) {
        const saved = await res.json();
        onSave(saved);
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function handleDelete() {
    if (!event || !onDelete) return;
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (res.ok) onDelete(event.id);
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden sm:mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-medium text-white">{isEditing ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-base)] text-gray-500 hover:text-gray-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-white text-sm focus-ring placeholder:text-gray-600"
              autoFocus
            />
          </div>

          {/* All Day Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] bg-[var(--bg-base)] text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-300">All day</span>
          </label>

          {/* Start Date/Time */}
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-white text-sm focus-ring"
            />
            {!allDay && (
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-28 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-white text-sm focus-ring"
              />
            )}
          </div>

          {/* End Date/Time */}
          <div className="flex gap-2">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End date"
              className="flex-1 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-white text-sm focus-ring placeholder:text-gray-600"
            />
            {!allDay && endDate && (
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-28 px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-white text-sm focus-ring"
              />
            )}
          </div>

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-md text-white text-sm focus-ring placeholder:text-gray-600 resize-none"
          />

          {/* Visibility */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 shrink-0">Visibility</span>
            <div className="flex gap-1 bg-[var(--bg-base)] rounded-md p-0.5 border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${visibility === 'private' ? 'bg-[var(--border)] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Private
              </button>
              <button
                type="button"
                onClick={() => setVisibility('team')}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${visibility === 'team' ? 'bg-[var(--border)] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Team
              </button>
            </div>
            <span className="text-[10px] text-gray-600">
              {visibility === 'team' ? 'Visible to all team members' : 'Only you can see this'}
            </span>
          </div>

          {/* Color Picker */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Color</p>
            <div className="flex gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-card)] scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Delete */}
          {isEditing && onDelete && (
            <div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete this event?</span>
                  <button onClick={handleDelete} className="px-3 py-1 bg-red-500 hover:bg-red-400 text-white text-xs font-medium rounded-md transition-colors">Delete</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete event
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !startDate || saving}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}