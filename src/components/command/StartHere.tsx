"use client";

import { useEffect, useState } from "react";
import { canonicalCaseId } from "@/lib/contract";
import type { Action } from "./state";
import type { CcBundle } from "./model/types";
import { nisarNoCandidates } from "./model/radar";

// "Start here" (judge report #6, conductor): four stops that show the
// project in under a minute. Each one sets case, day, hazard and layers in
// one step. Dismissed per browser (a convenience only: storage may fail).
export interface TourStop {
  key: string;
  title: string;
  what: string;
  action: Extract<Action, { type: "goTo" }>;
  primary?: boolean; // L42: NISAR first and largest
}

// L42 (conductor, challenge core = NISAR): NISAR first (WA swipe, HH | HV
// and the time series when published), then the live Southern Brazil NISAR
// card, then the rain index (RS), then the forecast replay (WA).
export function tourStops(cases: readonly CcBundle[]): TourStop[] {
  // Bundle ids may be the event ids ("wa-2025-12"); match the canonical key.
  const caseOf = (key: string) => cases.find((c) => c.mode !== "live" && canonicalCaseId(c.id) === key);
  const waCase = caseOf("wa_2025");
  const wa = waCase?.id;
  const rs = caseOf("rs_2024")?.id;
  const live = cases.find((c) => c.mode === "live");
  const hasHv = !!waCase?.manifest?.layers?.some((l) => l.id === "nisar_hv_pre");
  const extras = [hasHv ? "switch HH | HV" : undefined, waCase?.nisarSeries ? "see the radar time series" : undefined]
    .filter(Boolean).join(", then ");
  const stops: Omit<TourStop, "title">[] = [];
  if (wa) stops.push({
    key: "wa-radar", primary: true,
    what: `NISAR radar sees the flood through cloud: swipe before / after${extras ? `, ${extras}` : ""}`,
    action: { type: "goTo", id: wa, hazard: "flood", compare: "radar" },
  });
  if (live) stops.push({
    key: "now",
    what: nisarNoCandidates(live)
      ? `Latest NISAR pass: ${nisarNoCandidates(live)!.computed ? "no new flooding detected" : "no flood candidates (no usable pair)"} — plus today's risk and public alerts (every 3 h)`
      : "Today's NISAR radar flood candidates, risk and public alerts (every 3 h)",
    action: { type: "goTo", id: live.id },
  });
  if (rs) stops.push({
    key: "rs",
    what: "Rain warns: landslide risk on the event day, with landslide scar candidates seen from space",
    action: { type: "goTo", id: rs, hazard: "slide", layer: "candidates" },
  });
  if (wa) stops.push({
    key: "wa",
    what: "Replay: the landslide-risk forecast issued Dec 3 for Dec 6, as it was available then",
    action: { type: "goTo", id: wa, day: -7, hazard: "slide", lead: 3 },
  });
  const titles: Record<string, string> = {
    "wa-radar": "Washington, Dec 2025 — NISAR radar",
    // R2: no live NISAR candidates -> the stop is not billed as NISAR.
    now: live && nisarNoCandidates(live) ? "Now — Southern Brazil" : "Now — Southern Brazil, NISAR radar",
    rs: "Rio Grande do Sul, May 2024 — rain index",
    wa: "Washington, Dec 2025 — forecast replay",
  };
  return stops.map((s, i) => ({ ...s, title: `${i + 1} · ${titles[s.key]}` }));
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
        Start here: guided tour
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
              className={`w-full rounded-md border bg-cc-surface text-left hover:border-cc-accent ${s.primary ? "border-2 border-cc-accent px-2.5 py-2" : "border-cc-line px-2 py-1"}`}>
              <span className={`block font-semibold ${s.primary ? "text-[15px]" : "text-[13px]"}`}>{s.title}</span>
              <span className="block text-cc-muted">{s.what}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
