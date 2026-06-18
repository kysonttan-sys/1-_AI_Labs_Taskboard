interface Props {
  status: string;
}

function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function StatusBadge({ status }: Props) {
  const normalized = normalizeStatus(status);

  const labels: Record<string, string> = {
    todo: 'To Do',
    'to do': 'To Do',
    in_progress: 'In Progress',
    'in progress': 'In Progress',
    review: 'Review',
    done: 'Done',
    blocked: 'Blocked',
    completed: 'Done',
  };

  const colors: Record<string, string> = {
    todo: 'bg-slate-500/20 text-slate-400',
    'to do': 'bg-slate-500/20 text-slate-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    'in progress': 'bg-blue-500/20 text-blue-400',
    review: 'bg-yellow-500/20 text-yellow-400',
    done: 'bg-green-500/20 text-green-400',
    completed: 'bg-green-500/20 text-green-400',
    blocked: 'bg-red-500/20 text-red-400',
  };

  const display = labels[normalized] ?? status;
  const colorClass = colors[normalized] ?? 'bg-[var(--accent-muted)] text-[var(--accent)]';

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colorClass}`}>
      {display}
    </span>
  );
}
