'use client';

export default function OkrsError({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-4xl mx-auto rounded-md border border-red-500/20 bg-red-500/10 p-4 text-red-400">
        <h1 className="mb-2 text-lg font-semibold">Failed to load OKRs</h1>
        <p className="mb-2 text-sm">Server error:</p>
        <pre className="whitespace-pre-wrap rounded-md bg-black/30 p-3 text-xs">{error.message}</pre>
        {error.digest && (
          <p className="mt-2 text-xs text-red-300">Digest: {error.digest}</p>
        )}
        <p className="mt-3 text-xs text-red-300">
          Check Render server logs for the full stack trace.
        </p>
      </div>
    </div>
  );
}
