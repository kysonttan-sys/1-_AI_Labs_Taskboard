'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <p className="text-sm text-red-400">Something went wrong</p>
      <button
        onClick={reset}
        className="px-3 py-1.5 text-xs font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded-md transition-colors"
      >
        Try again
      </button>
    </div>
  );
}