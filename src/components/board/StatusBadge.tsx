interface Props {
  status: string;
}

export default function StatusBadge({ status }: Props) {
  const labels: Record<string, string> = {
    todo: 'Todo',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
  };
  const colors: Record<string, string> = {
    todo: 'bg-slate-500/20 text-slate-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    review: 'bg-yellow-500/20 text-yellow-400',
    done: 'bg-green-500/20 text-green-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[status] ?? colors.todo}`}>
      {labels[status] ?? status}
    </span>
  );
}
