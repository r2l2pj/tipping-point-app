"use client";

import { useEffect, useState } from "react";
import type { CaseBundle } from "@/lib/types";

export default function Header({
  cases,
  activeId,
  onSelect,
  onReplay,
}: {
  cases: CaseBundle[];
  activeId: string;
  onSelect: (id: string) => void;
  onReplay: () => void;
}) {
  const active = cases.find((c) => c.id === activeId);
  const live = active?.mode === "live";

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-800 bg-[#0b0e14] px-4">
      <div className="flex items-center gap-2.5">
        <Logo />
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-wider text-zinc-100">
            TIPPING POINT
          </h1>
          <span className="hidden text-xs text-zinc-400 sm:inline">
            | Rain warns. Radar confirms.
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200">
          <CalendarIcon />
          <select
            className="bg-transparent outline-none"
            value={activeId}
            onChange={(e) => onSelect(e.target.value)}
          >
            <optgroup label="Replay cases">
              {cases
                .filter((c) => c.mode === "replay")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
            </optgroup>
            {cases.some((c) => c.mode === "live") && (
              <optgroup label="Live">
                {cases
                  .filter((c) => c.mode === "live")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      Now — Southern Brazil (live)
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </label>

        {live ? (
          <FreshnessPill updatedAt={active?.updated_at} />
        ) : (
          <button
            onClick={onReplay}
            className="flex items-center gap-1.5 rounded bg-cyan-600 px-3 py-1.5 text-xs font-semibold tracking-wide text-white hover:bg-cyan-500"
          >
            <PlayIcon /> EVENT REPLAY · DEMO
          </button>
        )}
      </div>
    </header>
  );
}

// "Updated Xh ago" — computed on the client (Date.now is a request-time API).
function FreshnessPill({ updatedAt }: { updatedAt?: string }) {
  const [label, setLabel] = useState("live");
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!updatedAt) return;
    const update = () => {
      const mins = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000));
      setLabel(
        mins < 60
          ? `Updated ${mins} min ago`
          : `Updated ${Math.round(mins / 60)} h ago`
      );
      setStale(mins > 12 * 60); // pipeline runs every 6 h — flag after 12
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [updatedAt]);

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold tracking-wide text-white">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
        NOW · {label.toUpperCase()}
      </span>
      {stale && (
        <span className="rounded border border-amber-700 px-2 py-1 text-xs text-amber-400">
          showing last good data
        </span>
      )}
    </div>
  );
}

function Logo() {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden>
      <path d="M3 15 L10 4 L14 10 L18 3 L23 15" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinejoin="round" />
      <path d="M0 15 H26" stroke="#22d3ee" strokeWidth="2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" />
      <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2 1.5v9l8-4.5z" />
    </svg>
  );
}
