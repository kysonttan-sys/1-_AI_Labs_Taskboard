'use client';

import { useState, useEffect } from 'react';
import { useOkrStore } from '@/features/okrs/okrStore';
import { useProjectStore } from '@/features/projects/projectStore';
import { X } from 'lucide-react';
import { AiAssistButton } from '@/components/ai/AiAssistButton';
import type { Objective as ApiObjective } from '@/lib/api/okrs';

type Objective = ApiObjective;

interface Props {
  objective?: Objective;
  onClose: () => void;
}

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

export default function ObjectiveCreateModal({ objective, onClose }: Props) {
  const isEdit = !!objective;
  const { createObjective, updateObjective } = useOkrStore();
  const { projects, fetchProjects } = useProjectStore();

  const [title, setTitle] = useState(objective?.title ?? '');
  const [description, setDescription] = useState(objective?.description ?? '');
  const [startDate, setStartDate] = useState(toDateInput(objective?.startDate ?? new Date().toISOString()));
  const [endDate, setEndDate] = useState(toDateInput(objective?.endDate ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()));
  const [projectId, setProjectId] = useState(objective?.projectId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after start date.');
      return;
    }

    if (!projectId) {
      setError('Please select a project.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && objective) {
        await updateObjective(objective.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
        });
      } else {
        await createObjective({
          title: title.trim(),
          description: description.trim() || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          projectId,
        });
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] p-4">
      <div className="w-full max-w-md card-base p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {isEdit ? 'Edit objective' : 'New objective'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && (
            <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Title</label>
            <div className="flex items-start gap-1.5">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="flex-1 px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
              />
              <AiAssistButton
                field="objective-title"
                value={title}
                projectId={projectId}
                objectiveId={objective?.id}
                onApply={(s) => setTitle(s.trim())}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Description (optional)</label>
            <div className="flex items-start gap-1.5">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                className="flex-1 px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring resize-none"
              />
              <AiAssistButton
                field="objective-description"
                value={description}
                projectId={projectId}
                objectiveId={objective?.id}
                onApply={(s) => setDescription(s.trim())}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
              />
            </div>
          </div>

          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
              >
                <option value="" disabled>Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-medium text-[var(--text-primary)] disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create objective'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
