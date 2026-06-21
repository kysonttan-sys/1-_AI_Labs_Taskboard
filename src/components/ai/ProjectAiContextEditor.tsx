'use client';

import { useState } from 'react';
import { useProjectStore } from '@/features/projects/projectStore';
import { FileText, Save, Loader2 } from 'lucide-react';
import { AiAssistButton } from './AiAssistButton';

interface ProjectAiContextEditorProps {
  projectId: string;
  initialContext: string | null;
}

export default function ProjectAiContextEditor({ projectId, initialContext }: ProjectAiContextEditorProps) {
  const { updateProject } = useProjectStore();
  const [context, setContext] = useState(initialContext || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateProject(projectId, { aiContext: context });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-base p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-4 w-4 text-[var(--accent)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Project context for AI</h3>
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">
        Describe what this project is about, goals, scope, stakeholders, or any background. The AI uses this to give
        better suggestions for this project.
      </p>
      <div className="flex items-start gap-2">
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Example: This project builds a customer self-service portal. Goals: reduce support tickets by 20%, launch by end of Q3. Stakeholders: Marketing and Customer Success."
          className="flex-1 min-h-[120px] rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 resize-y"
        />
        <AiAssistButton
          field="project-context"
          value={context}
          projectId={projectId}
          onApply={(s) => setContext(s.trim())}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-medium text-[var(--text-primary)] transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save context
        </button>
        {saved && <span className="text-xs text-green-400">Saved!</span>}
      </div>
    </div>
  );
}
