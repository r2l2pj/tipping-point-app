"use client";

import { useEffect, useState } from "react";
import { canonicalCaseId } from "@/lib/contract";
import type { Action } from "./state";
import type { CcBundle } from "./model/types";

// "Start here" (judge report #6, conductor): three stops that show the
// project in under a minute. Each one sets case, day, hazard and layers in
// one step. Dismissed per browser (a convenience only: storage may fail).
export interface TourStop {
  key: string;
  title: string;
  what: string;
  action: Extract<Action, { type: "goTo" }>;
}

export function tourStops(cases: readonly CcBundle[]): TourStop[] {
  // Bundle ids may be the event ids ("wa-2025-12"); match the canonical key.
  const idOf = (key: string) => cases.find((c) => c.mode !== "live" && canonicalCaseId(c.id) === key)?.id;
  const wa = idOf("wa_2025");
  const rs = idOf("rs_2024");
  const live = cases.find((c) => c.mode === "live");
  const out: TourStop[] = [];
  if (wa) out.push({
    key: "wa", title: "1 · Washington, Dec 2025",
    what: "Replay: the landslide-risk forecast issued Dec 3 for Dec 6, as it was available then",
    action: { type: "goTo", id: wa, day: -7, hazard: "slide", lead: 3 },
  });
  if (rs) out.push({
    key: "rs", title: "2 · Rio Grande do Sul, May 2024",
    what: "Landslide risk on the event day, with landslide scar candidates seen from space",
    action: { type: "goTo", id: rs, hazard: "slide", layer: "candidates" },
  });
  if (live) out.push({
    key: "now", title: "3 · Now — Southern Brazil",
    what: "Today's run: NISAR radar flood candidates, risk and public alerts",
    action: { type: "goTo", id: live.id },
  });
  return out;
}

const KEY = "tp-start-here-dismissed";

export default function StartHere({ cases, dispatch }: { cases: readonly CcBundle[]; dispatch: (a: Action) => void }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount (no storage on the server)
      if (window.localStorage.getItem(KEY) === "1") setOpen(false);
    } catch {
      // storage blocked: the card simply stays open
    }
  }, []);
  const stops = tourStops(cases);
  if (!stops.length) return null;
  const close = (v: boolean) => {
    setOpen(v);
    try { window.localStorage.setItem(KEY, v ? "0" : "1"); } catch { /* convenience only */ }
  };
  if (!open) {
    return (
      <button type="button" onClick={() => close(true)} data-start-here="closed"
        className="self-start rounded-md border border-cc-line-strong px-2 py-0.5 text-xs font-semibold">
        Start here: 3-stop tour
      </button>
    );
  }
  return (
    <section aria-label="Start here" data-start-here="open" className="rounded-lg border border-cc-accent-line bg-cc-accent-soft p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-[13px] font-semibold">Start here</h2>
        <button type="button" onClick={() => close(false)} className="text-xs font-semibold underline">Hide</button>
      </div>
      <ol className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
        {stops.map((s) => (
          <li key={s.key}>
            <button type="button" onClick={() => dispatch(s.action)} data-tour={s.key}
              className="w-full rounded-md border border-cc-line bg-cc-surface px-2 py-1 text-left hover:border-cc-accent">
              <span className="block text-[13px] font-semibold">{s.title}</span>
              <span className="block text-cc-muted">{s.what}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
