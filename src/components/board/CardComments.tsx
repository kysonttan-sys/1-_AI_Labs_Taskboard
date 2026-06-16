'use client';

import React, { useState } from 'react';
import { MessageSquare, XCircle } from 'lucide-react';
import { getInitials } from '@/lib/utils';

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  author: { name: string; color: string };
}

interface CardCommentsProps {
  cardId: string;
  comments: Comment[];
  onChange: (comments: Comment[]) => void;
}

export default function CardComments({ cardId, comments, onChange }: CardCommentsProps) {
  const [newComment, setNewComment] = useState('');

  function postComment(text: string) {
    fetch(`/api/cards/${cardId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then((res) => res.json())
      .then((comment) => onChange([...comments, comment]))
      .catch(() => {});
  }

  function deleteComment(id: string) {
    onChange(comments.filter((c) => c.id !== id));
    fetch(`/api/comments/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  return (
    <div>
      <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <MessageSquare className="h-3 w-3" />
        Comments
      </label>
      {comments.length > 0 && (
        <div className="space-y-2 mb-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 px-2 py-1.5 rounded-md bg-[var(--bg-surface)] group">
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                style={{ backgroundColor: `${comment.author?.color || '#6366f1'}22`, color: comment.author?.color || '#6366f1' }}
              >
                {getInitials(comment.author?.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--text-secondary)] break-words">{comment.text}</p>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                  {comment.author?.name || 'Unknown'} &middot; {new Date(comment.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => deleteComment(comment.id)}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-red-400 transition-all shrink-0 self-start mt-0.5"
                title="Delete comment"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newComment.trim()) {
              const text = newComment.trim();
              setNewComment('');
              postComment(text);
            }
          }}
          placeholder="Write a comment..."
          className="flex-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-tertiary)] focus-ring"
        />
        <button
          onClick={() => {
            if (!newComment.trim()) return;
            const text = newComment.trim();
            setNewComment('');
            postComment(text);
          }}
          disabled={!newComment.trim()}
          className="px-2.5 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:hover:bg-[var(--accent)] text-[var(--text-primary)] rounded-md transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
