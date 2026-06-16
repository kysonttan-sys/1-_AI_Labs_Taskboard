'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/features/projects/projectStore';
import { FolderKanban, Plus, Trash2, Pencil, Check, X } from 'lucide-react';

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, fetchProjects, createProject, updateProject, deleteProject } = useProjectStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createProject({ name, description: newDesc.trim() || undefined });
    setNewName('');
    setNewDesc('');
    setIsCreating(false);
  };

  const startEdit = (project: { id: string; name: string; description: string | null }) => {
    setEditingId(project.id);
    setEditName(project.name);
    setEditDesc(project.description || '');
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    await updateProject(id, { name, description: editDesc.trim() || undefined });
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderKanban className="h-6 w-6 text-[var(--accent)]" />
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Projects</h1>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-medium text-[var(--text-primary)] transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {isCreating && (
        <div className="card-base p-4 mb-4 space-y-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name..."
            className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              className="px-3 py-1.5 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-medium text-[var(--text-primary)]"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewName('');
                setNewDesc('');
              }}
              className="px-3 py-1.5 rounded text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => router.push(`/projects/${project.id}`)}
            className="card-base p-4 cursor-pointer hover:border-[var(--accent)]/40 transition-colors"
          >
            {editingId === project.id ? (
              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
                />
                <input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Description"
                  className="w-full px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded text-[var(--text-primary)] focus-ring"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveEdit(project.id)}
                    className="p-1 rounded bg-[var(--accent)] text-[var(--text-primary)]"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-surface)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--text-primary)]">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-[var(--text-tertiary)] mt-1">{project.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(project);
                      }}
                      className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete project "${project.name}"? Boards and OKRs inside will also be deleted.`)) {
                          deleteProject(project.id);
                        }
                      }}
                      className="p-1 rounded hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-3">
                  Click to view boards and OKRs
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
