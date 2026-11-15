"use client";

import type { CheckRow } from "./model/replayCheck";
import { Value } from "./ui";

// Headline rows of the replay: one row per metric the case has. The details
// (validation and impact content) open below.
export default function ReplayCheck({
  rows,
  detailsOpen,
  onToggleDetails,
  children,
}: {
  rows: CheckRow[];
  detailsOpen: boolean;
  onToggleDetails: () => void;
  children?: React.ReactNode;
}) {
  return (
    <section id="cc-check" aria-label="Replay check" className="scroll-mt-24 rounded-[10px] border border-cc-line bg-cc-well px-3.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2.5">
        <h2 className="m-0 font-cc-display text-[15px] font-semibold">Replay check</h2>
        <span className="text-xs text-cc-faint">Did the index get it right? Measured after the event.</span>
      </div>
      {rows.map((r) => (
        <div key={r.id} data-check={r.id} className="mt-0.5 border-t border-[#e3e7e1] py-0.5 text-[13px] leading-snug">
          <div className="flex gap-2.5">
            {/* Both sides wrap: a long value (the lead-time headline) must not
                widen the panel past a 390 px phone. */}
            <span className="min-w-0 flex-1 text-cc-muted">{r.name}</span>
            <Value text={r.value} missing={r.missing} className="min-w-0 max-w-[62%] break-words text-right tabular-nums" />
          </div>
          {r.detail && <div className="text-right text-xs text-cc-faint">{r.detail}</div>}
        </div>
      ))}
      <button type="button" onClick={onToggleDetails} aria-expanded={detailsOpen}
        className="mt-1.5 text-[13px] font-semibold text-cc-accent underline decoration-dotted underline-offset-2">
        {detailsOpen ? "Hide details" : "Show details: validation and impact"}
      </button>
      {detailsOpen && children}
    </section>
  );
}
