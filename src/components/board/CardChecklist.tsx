'use client';

import React, { useState } from 'react';
import { CheckSquare, Plus, X } from 'lucide-react';
import type { Card } from '@/types';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface CardChecklistProps {
  cardId: string;
  checklist: ChecklistItem[];
  onChange: (checklist: ChecklistItem[]) => void;
}

export default function CardChecklist({ cardId, checklist, onChange }: CardChecklistProps) {
  const [newCheckItem, setNewCheckItem] = useState('');
  const checkedCount = checklist.filter((i) => i.checked).length;

  function toggleCheckItem(id: string) {
    const item = checklist.find((i) => i.id === id);
    if (!item) return;
    const nextChecked = !item.checked;
    onChange(checklist.map((i) => (i.id === id ? { ...i, checked: nextChecked } : i)));
    fetch(`/api/checklist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: nextChecked }),
    }).catch(() => {});
  }

  function addCheckItem() {
    if (!newCheckItem.trim()) return;
    const text = newCheckItem.trim();
    setNewCheckItem('');
    fetch(`/api/cards/${cardId}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((res) => res.json())
      .then((item) => onChange([...checklist, item]))
      .catch(() => {});
  }

  function deleteCheckItem(id: string) {
    onChange(checklist.filter((item) => item.id !== id));
    fetch(`/api/checklist/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  return (
    <div>
      <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <CheckSquare className="h-3 w-3" />
        Checklist
        {checklist.length > 0 && (
          <span className="text-[var(--text-tertiary)]">
            {checkedCount}/{checklist.length}
          </span>
        )}
      </label>

      {checklist.length > 0 && (
        <div className="space-y-1 mb-2">
          {checklist.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors group"
            >
              <label className="flex items-center gap-2 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleCheckItem(item.id)}
                  className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]/40 bg-[var(--bg-surface)]"
                />
                <span
                  className={`text-sm ${
                    item.checked
                      ? 'line-through text-[var(--text-tertiary)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {item.text}
                </span>
              </label>
              <button
                onClick={() => deleteCheckItem(item.id)}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-400 transition-all shrink-0"
                title="Delete item"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={newCheckItem}
          onChange={(e) => setNewCheckItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addCheckItem();
          }}
          placeholder="Add item..."
          className="flex-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus-ring"
        />
        <button
          onClick={addCheckItem}
          disabled={!newCheckItem.trim()}
          className="px-2.5 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:hover:bg-[var(--accent)] text-[var(--text-primary)] rounded-md transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
