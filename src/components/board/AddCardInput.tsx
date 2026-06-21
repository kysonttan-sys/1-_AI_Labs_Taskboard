'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { AiAssistButton } from '@/components/ai/AiAssistButton';

interface AddCardInputProps {
  listId: string;
  projectId?: string;
  onAdd: (listId: string, title: string) => Promise<void>;
}

export default function AddCardInput({ listId, projectId, onAdd }: AddCardInputProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');

  async function handleAdd() {
    if (!title.trim()) return;
    await onAdd(listId, title.trim());
    setTitle('');
    setIsAdding(false);
  }

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full flex items-center gap-1 px-2 py-1.5 rounded-md text-sm
          text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Add card</span>
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1.5">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Card title..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') setIsAdding(false);
          }}
          onBlur={() => {
            if (!title.trim()) setIsAdding(false);
          }}
          className="flex-1 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border)]
            rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-ring"
        />
        <AiAssistButton
          field="card-title"
          value={title}
          projectId={projectId}
          onApply={(s) => {
            setTitle(s.trim());
          }}
        />
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={handleAdd}
          className="px-2.5 py-1 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded-md transition-colors"
        >
          Add
        </button>
        <button
          onClick={() => setIsAdding(false)}
          className="px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
