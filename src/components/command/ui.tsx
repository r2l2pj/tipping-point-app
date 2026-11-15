// Small shared pieces of the Command Center shell.
import type { ReactNode } from "react";
import { CLASS_COLOR } from "./model/legend";

export function Icon({
  d,
  size = 18,
  fill = false,
  strokeWidth = 1.9,
  className,
}: {
  d: string;
  size?: number;
  fill?: boolean;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

export const ICON = {
  layers: "M12 3.5l8.5 4.5-8.5 4.5L3.5 8zM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5",
  chevronUp: "M6 15l6-6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  warn: "M12 3.5L2.5 20h19zM12 10v4.5M12 17.3v.2",
  info: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5.5M12 7.5v.3",
  play: "M7 5v14l12-7z",
  pause: "M8 5v14M16 5v14",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  people:
    "M9 11a3.2 3.2 0 100-6.4A3.2 3.2 0 009 11zM3 19c0-3 2.7-5 6-5s6 2 6 5M16 5.2a3 3 0 010 5.6M17.5 14.3c2.2.6 3.5 2.3 3.5 4.7",
  radar:
    "M10.5 12a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7M5.8 5.8a8.8 8.8 0 000 12.4M18.2 5.8a8.8 8.8 0 010 12.4",
  send: "M21 3.5L3 10.5l7 3 3 7z",
  pin: "M12 21s6.5-6 6.5-11a6.5 6.5 0 10-13 0c0 5 6.5 11 6.5 11zM12 12.3a2.3 2.3 0 100-4.6 2.3 2.3 0 000 4.6z",
  command: "M4 5h16v11H4zM9 20h6M12 16v4",
  megaphone: "M4 10v4h3l6 4V6l-6 4zM16.5 9a4 4 0 010 6",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7.5V12l3 2",
} as const;

// Class chip: the class word is always next to the class color.
export function ClassChip({ cls, className = "" }: { cls: string; className?: string }) {
  const bg = CLASS_COLOR[cls];
  const dark = cls === "Critical";
  return (
    <span
      className={`inline-block rounded-[5px] px-2 py-0.5 text-center text-[13px] font-semibold ${className}`}
      style={
        bg
          ? { background: bg, color: dark ? "#ffffff" : "#16242b", border: dark ? undefined : "1px solid #c9b96a" }
          : { border: "1px solid var(--cc-line-strong)" }
      }
    >
      {cls || "class not published"}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[10px] border border-cc-line px-3 py-2 ${className}`}>{children}</div>
  );
}

// A value that may be missing: missing text is muted and never bold.
export function Value({ text, missing, className = "" }: { text: string; missing: boolean; className?: string }) {
  return (
    <span className={`${missing ? "text-[13px] font-normal italic text-cc-faint" : "font-semibold"} ${className}`}>
      {text}
    </span>
  );
}

export function StatGrid({ stats }: { stats: { label: string; value: string; missing: boolean }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-cc-line bg-cc-well px-2.5 py-1.5">
          <dd className="text-[15px]"><Value text={s.value} missing={s.missing} /></dd>
          <dt className="text-xs leading-tight text-cc-muted">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}
