"use client";

import { useEffect, useRef } from "react";
import { NO_STEPS_TEXT, type Step, type StepMark } from "./model/steps";
import { Icon, ICON } from "./ui";

// Transport, steps, marks and the forecast tag. Previous / next move one step.
export default function TimelineBar({
  steps,
  marks,
  dayIndex,
  playing,
  forecastTag,
  onSeek,
  onPrev,
  onNext,
  onPlayToggle,
  children,
}: {
  steps: Step[];
  marks: StepMark[];
  dayIndex: number;
  playing: boolean;
  forecastTag: string;
  onSeek: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onPlayToggle: () => void;
  children?: React.ReactNode; // data sources
}) {
  const n = steps.length;
  // Keep the selected step in view when the steps scroll sideways.
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scrolls the track only, never the page.
    const box = track.current;
    const el = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!box || !el) return;
    const left = el.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft) box.scrollLeft = left;
    else if (left + el.offsetWidth > box.scrollLeft + box.clientWidth) {
      box.scrollLeft = left + el.offsetWidth - box.clientWidth;
    }
  }, [dayIndex, n]);
  const firstFc = steps.findIndex((s) => s.forecast);
  const small = "inline-flex h-[38px] w-10 items-center justify-center rounded-lg border border-cc-line-strong bg-cc-surface disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border border-cc-line bg-cc-surface px-4 py-2 shadow-[0_4px_18px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onPlayToggle} disabled={n < 2} aria-label={playing ? "Pause" : "Play"}
          className="inline-flex h-[46px] w-[50px] items-center justify-center rounded-[10px] bg-cc-accent text-white disabled:cursor-not-allowed disabled:opacity-50">
          <Icon d={playing ? ICON.pause : ICON.play} size={20} fill={!playing} strokeWidth={playing ? 3 : 2.2} />
        </button>
        <button type="button" onClick={onPrev} disabled={n === 0 || dayIndex <= 0} aria-label="Previous step" className={small}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 5v14l-10-7z" /><path d="M6 5v14" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" onClick={onNext} disabled={n === 0 || dayIndex >= n - 1} aria-label="Next step" className={small}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 5v14l10-7z" /><path d="M18 5v14" fill="none" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div ref={track} className="min-w-0 flex-[1_1_460px] overflow-x-auto">
        {n === 0 ? (
          <p className="py-3 text-[13px] italic text-cc-faint">{NO_STEPS_TEXT}</p>
        ) : (
          <div className="relative flex pt-5" style={{ minWidth: Math.max(470, n * 46) }} role="group" aria-label="Timeline steps">
            {firstFc >= 0 && (
              <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-md bg-cc-forecast px-3 py-px text-xs font-semibold text-cc-forecast-ink"
                style={{ left: `${((firstFc + (n - firstFc) / 2) / n) * 100}%` }}>
                {forecastTag}
              </span>
            )}
            {steps.map((s) => {
              const on = s.index === dayIndex;
              const event = s.offset === 0;
              return (
                <button
                  key={s.date}
                  type="button"
                  onClick={() => onSeek(s.index)}
                  aria-pressed={on}
                  aria-label={`${s.top}${s.sub ? `, ${s.sub}` : ""}${s.forecast ? `, ${forecastTag}` : ""}`}
                  title={`${s.date}${s.day && typeof s.day.tpi === "number" ? ` — TPI ${s.day.tpi.toFixed(2)}` : ""}`}
                  className="relative flex min-h-[60px] min-w-0 flex-1 flex-col items-center"
                >
                  {/* Track: solid for observed steps, dashed for forecast. */}
                  <span aria-hidden="true" className={`absolute left-0 right-0 top-[12px] ${s.forecast ? "border-t-[3px] border-dashed border-[#9aa7a0]" : "h-[3px] bg-cc-accent"}`} />
                  <span aria-hidden="true" className="relative flex h-[26px] items-center">
                    <span className={`box-border rounded-full ${on ? "h-[18px] w-[18px]" : "h-3 w-3"} ${
                      on ? "border-[3px] border-cc-accent bg-white shadow-[0_0_0_3px_rgba(23,71,63,0.25)]"
                      : s.forecast ? "border-2 border-dashed border-[#5f6d73] bg-white"
                      : "border-2 border-cc-accent bg-cc-accent"}`} />
                  </span>
                  <span className="absolute top-[30px] flex gap-1">
                    {marks.filter((m) => m.index === s.index).map((m) => (
                      <span key={m.label} title={m.label} aria-label={m.label} role="img"
                        className={`h-2 w-1.5 rounded-full ${m.color === "red" ? "bg-[#bd0026]" : "bg-[#d98a00]"}`} />
                    ))}
                  </span>
                  <span className={`mt-2 whitespace-nowrap leading-tight ${on ? "text-[13px] font-bold" : "text-xs font-medium"}`}>{s.top}</span>
                  <span className={`whitespace-nowrap text-xs leading-tight ${event ? "rounded bg-cc-ink px-1 font-semibold text-white" : "text-cc-muted"}`}>{s.sub}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
