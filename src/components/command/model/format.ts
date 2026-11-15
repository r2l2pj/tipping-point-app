// Date, hour and number text for the Command Center (took over the old
// tabs/format.ts). It lives here because src/lib is owned by other work.
import { fmtDataDate, fmtDate, fmtDateTime } from "@/lib/layers";
import { NOT_PUBLISHED } from "./types";

export { fmtDataDate, fmtDate, fmtDateTime };

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export { finite };

// BRT wall time for timestamps (America/Sao_Paulo). Date-only strings are
// calendar dates and render without a clock and without a day shift.
export const fmtBrt = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (!/T|\d:\d/.test(iso)) return fmtDate(iso);
  return (
    d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    }) + " BRT"
  );
};

// Short step date: "Dec 10". Calendar date, no shift.
export const fmtDayShort = (iso: string): string => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

// Whole hours: 47.5 -> "48 h".
export const fmtHours = (v: unknown): string =>
  finite(v) ? `${Math.round(v)} h` : NOT_PUBLISHED;

// A sub-0.05 area must not render as "0.0": the zone exists.
export const fmtKm2 = (v: unknown): string =>
  !finite(v) ? NOT_PUBLISHED : v > 0 && v < 0.05 ? "<0.1 km²" : `${v.toFixed(1)} km²`;

// People are rounded to hundreds, as the app did before.
export const fmtPeople = (v: unknown): string =>
  finite(v)
    ? (Math.round(v / 100) * 100).toLocaleString("en-US")
    : NOT_PUBLISHED;

export const fmtPct = (v: unknown): string =>
  finite(v) ? `${Math.round(v * 100)}%` : NOT_PUBLISHED;

export const fmtScore = (v: unknown): string =>
  finite(v) ? v.toFixed(2) : NOT_PUBLISHED;

// Age of a timestamp against a clock value supplied by the caller (the
// browser, after mount). Never computed during a server render.
export function ageText(iso: string | undefined | null, nowMs: number): string | undefined {
  if (!iso) return undefined;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const t = new Date(dateOnly ? `${iso}T12:00:00Z` : iso).getTime();
  if (Number.isNaN(t)) return undefined;
  const mins = Math.max(0, Math.round((nowMs - t) / 60000));
  if (dateOnly) {
    const days = Math.floor(mins / 1440);
    return days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
  }
  if (mins < 60) return `${mins} min ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} days ago`;
}

// Time of a data source as an ISO string. The live run publishes three
// shapes: a full timestamp, an hour without minutes ("2026-11-14T00Z") and a
// granule file name that carries the time ("..._20261110T223000_..."). The
// time is read from the published text; an unknown shape returns undefined.
export function sourceTime(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const hour = /^(\d{4}-\d{2}-\d{2})T(\d{2})Z$/.exec(raw);
  if (hour) return `${hour[1]}T${hour[2]}:00:00Z`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw) && !Number.isNaN(new Date(raw).getTime())) return raw;
  const stamp = /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/.exec(raw);
  if (stamp) {
    const iso = `${stamp[1]}-${stamp[2]}-${stamp[3]}T${stamp[4]}:${stamp[5]}:${stamp[6]}Z`;
    if (!Number.isNaN(new Date(iso).getTime())) return iso;
  }
  return undefined;
}

// English word of a TPI class. The live run names classes in Portuguese
// ("Baixo", "Moderado", "Alto", "Crítico"); an unknown name is shown as is.
const CLASS_EN: Record<string, string> = {
  baixo: "Low",
  moderado: "Moderate",
  alto: "High",
  critico: "Critical",
};
export const classLabel = (name: string): string =>
  CLASS_EN[name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()] ?? name;
