"use client";

// Route error boundary: a failed loader must surface a real message instead
// of leaving the Suspense fallback ("Loading dashboard…") up forever.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0b0e14] text-zinc-100">
      <p className="text-sm text-zinc-300">
        Dashboard data failed to load — data feeds may be temporarily
        unreachable.
      </p>
      <p className="max-w-md truncate text-xs text-zinc-600">
        {error.message}
      </p>
      <button
        onClick={reset}
        className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Retry
      </button>
    </div>
  );
}
