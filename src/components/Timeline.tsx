"use client";

import type { SeriesDaily } from "@/lib/types";

export default function Timeline({
  series,
  dayIndex,
  playing,
  onSeek,
  onPlayToggle,
}: {
  series?: SeriesDaily;
  dayIndex: number;
  playing: boolean;
  onSeek: (i: number) => void;
  onPlayToggle: () => void;
}) {
  const days = series?.days ?? [];
  const n = days.length;
  const label = (offset: number) =>
    offset === 0 ? (series?.event === "now" ? "NOW" : "EVENT") : offset < 0 ? `D${offset}` : `D+${offset}`;

  return (
    <div className="flex h-16 shrink-0 items-center gap-4 border-t border-zinc-800 bg-[#0b0e14] px-4">
      <div className="flex items-center gap-1.5">
        <TransportBtn onClick={() => onSeek(0)} title="Back to start">
          <SkipBackIcon />
        </TransportBtn>
        <button
          onClick={onPlayToggle}
          title={playing ? "Pause" : "Play"}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-cyan-700 bg-cyan-900/60 text-cyan-300 hover:bg-cyan-800"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <TransportBtn onClick={() => onSeek(n - 1)} title="Skip to end">
          <SkipFwdIcon />
        </TransportBtn>
      </div>

      <div className="relative flex-1">
        <div className="flex items-center justify-between">
          {days.map((d, i) => {
            const isEvent = d.offset === 0;
            const forecast = d.kind === "forecast";
            const activeHere = i === dayIndex;
            return (
              <button
                key={d.date}
                onClick={() => onSeek(i)}
                className="group relative flex flex-col items-center"
                title={`${d.date} — TPI ${d.tpi.toFixed(2)}`}
              >
                <span
                  className={`block rounded-full border-2 transition-all ${
                    isEvent
                      ? "h-4 w-4 border-red-500 bg-red-500"
                      : activeHere
                        ? "h-4 w-4 border-cyan-400 bg-cyan-400"
                        : forecast
                          ? "h-3 w-3 border-dashed border-zinc-500 bg-transparent"
                          : "h-3 w-3 border-zinc-500 bg-zinc-700 group-hover:border-zinc-300"
                  }`}
                />
                <span
                  className={`absolute top-5 whitespace-nowrap text-[10px] font-semibold tracking-wide ${
                    isEvent
                      ? "rounded bg-red-600 px-1.5 py-0.5 text-white"
                      : activeHere
                        ? "text-cyan-400"
                        : "text-zinc-500"
                  }`}
                >
                  {label(d.offset)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="absolute left-0 right-0 top-[7px] -z-0 h-px bg-zinc-700" />
      </div>

      <div className="flex w-40 items-center justify-center gap-2 rounded-md border border-dashed border-zinc-600 px-2 py-2">
        <CloudIcon />
        <div className="text-[10px] leading-tight text-zinc-400">
          <span className="font-semibold text-zinc-300">Forecast +72h</span>
          <br />(projection)
        </div>
      </div>
    </div>
  );
}

function TransportBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
    >
      {children}
    </button>
  );
}

const iconProps = { width: 12, height: 12, viewBox: "0 0 12 12", fill: "currentColor", "aria-hidden": true } as const;
const SkipBackIcon = () => <svg {...iconProps}><path d="M3 1.5v9H1.5v-9zM10.5 1.5v9L3 6z" /></svg>;
const SkipFwdIcon = () => <svg {...iconProps}><path d="M9 1.5v9h1.5v-9zM1.5 1.5v9l7.5-4.5z" /></svg>;
const PlayIcon = () => <svg {...iconProps}><path d="M2.5 1.5v9l8-4.5z" /></svg>;
const PauseIcon = () => <svg {...iconProps}><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" /></svg>;
const CloudIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
    <path d="M4.5 10a3 3 0 0 1-.6-5.94A4 4 0 0 1 11.7 5.2 2.8 2.8 0 0 1 11.5 10z" />
    <path d="M5 12.5v1M8 12.5v1.5M11 12.5v1" strokeDasharray="1 1.5" />
  </svg>
);
