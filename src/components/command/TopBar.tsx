"use client";

import MethodsDrawer from "./MethodsDrawer";
import type { CcBundle } from "./model/types";
import { Icon, ICON } from "./ui";

export type View = "command" | "public";

const seg = (on: boolean) =>
  `inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ${
    on ? "bg-cc-accent text-white" : "bg-transparent text-cc-ink hover:bg-cc-well"
  } disabled:cursor-not-allowed disabled:opacity-50`;

export default function TopBar({
  cases,
  bundle,
  view,
  onView,
  onMode,
  onSelectCase,
  freshness,
  freshnessKind,
}: {
  cases: readonly CcBundle[];
  bundle: CcBundle | undefined;
  view: View;
  onView: (v: View) => void;
  onMode: (m: "now" | "replay") => void;
  onSelectCase: (id: string) => void;
  freshness: string;
  freshnessKind: string;
}) {
  const live = bundle?.mode === "live";
  const replays = cases.filter((c) => c.mode === "replay");
  const hasLive = cases.some((c) => c.mode === "live");
  const tone =
    freshnessKind === "live" ? "border-cc-accent-line bg-cc-accent-soft text-cc-accent"
    : freshnessKind === "archive" ? "border-cc-line-strong bg-cc-surface text-cc-muted"
    : "border-[#e2c48a] bg-cc-warn-soft text-cc-warn";

  return (
    <header className="relative z-10 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-cc-line bg-cc-header px-5 py-2">
      <svg width="38" height="24" viewBox="0 0 34 22" fill="none" stroke="var(--cc-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 19l8-12 5 7 4-6 7 11" /><path d="M20 19l5-7 7 7" />
      </svg>
      <span className="font-cc-display text-[22px] font-bold tracking-[0.04em]">TIPPING POINT</span>
      <span className="hidden border-l border-cc-line-strong pl-3.5 text-[15px] text-cc-muted min-[1500px]:inline">
        Rain warns. Radar confirms.
      </span>
      <div className="grow" />

      <div role="group" aria-label="View" className="inline-flex rounded-full border border-cc-line-strong bg-cc-surface p-[3px]">
        <button type="button" aria-pressed={view === "command"} onClick={() => onView("command")} className={seg(view === "command")}>
          <Icon d={ICON.command} /> Command Center
        </button>
        <button type="button" aria-pressed={view === "public"} onClick={() => onView("public")} className={seg(view === "public")}>
          <Icon d={ICON.megaphone} /> Public Alerts
        </button>
      </div>

      <div role="group" aria-label="Time" className="inline-flex rounded-full border border-cc-line-strong bg-cc-surface p-[3px]">
        <button type="button" aria-pressed={live} disabled={!hasLive} onClick={() => onMode("now")} className={seg(!!live)}>
          Now
        </button>
        <button type="button" aria-pressed={!!bundle && !live} disabled={replays.length === 0} onClick={() => onMode("replay")} className={seg(!!bundle && !live)}>
          <Icon d={ICON.play} size={14} strokeWidth={2.2} /> Replay
        </button>
      </div>

      <div className="flex h-[42px] items-center gap-1.5 rounded-[10px] border border-cc-line-strong bg-cc-surface pl-3 pr-2">
        <Icon d={ICON.pin} fill strokeWidth={1} />
        {live || !bundle ? (
          <span className="px-1 text-sm font-semibold" aria-label="Region">Southern Brazil</span>
        ) : (
          <select
            aria-label="Past event"
            value={bundle.id}
            onChange={(e) => onSelectCase(e.target.value)}
            className="h-[38px] max-w-[200px] border-0 bg-cc-surface px-1 text-sm font-semibold text-cc-ink"
          >
            {replays.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
      </div>

      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tone}`} role="status">
        <Icon d={ICON.clock} size={14} /> {freshness}
      </span>
      <MethodsDrawer />
    </header>
  );
}
