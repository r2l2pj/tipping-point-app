// Replay public view: the alerts the live alert rule WOULD have issued,
// built from replay data already in the bundle. Rule (same as live): an
// alert is raised when the TPI class rises to High/Critical for today or
// tomorrow (D+1). Consecutive days at the same level + hazard collapse into
// the first day ("still Critical through <last day>"). Pure, no React.
import { EITHER_HAZARD, type AlertCardData } from "@/lib/alerts";
import { count } from "@/lib/contract";
import type { AlertLevel } from "@/lib/types";
import { fmtDate } from "./format";
import type { CcBundle } from "./types";

export const REPLAY_ALERTS_TITLE = "Replay: what would have been sent";
export const REPLAY_ALERTS_NOTE = "Built from the replay TPI frames with the live alert rule. Not sent to anyone.";
export const REPLAY_NO_ALERTS_TEXT = "The live alert rule would not have issued an alert in this replay.";
export const OBSERVED_BASIS = "observed (IMERG + SMAP as of that day)";
export const forecastBasis = (issue: string) => `forecast · NOAA GFS (issued ${fmtDate(issue)})`;

type Source = "forecast" | "observed";

// One day on which the rule fires.
interface Hit {
  date: string;
  level: AlertLevel;
  hazard: string;
  source: Source;
  km2?: number;
  people?: number;
}

export interface ReplayAlert extends AlertCardData {
  date: string; // day the alert would have been raised
  through: string; // last consecutive day at the same level + hazard
  source: Source;
}

export interface ReplayAlertList {
  shown: ReplayAlert[];
  later: number; // alerts dated after the selected step
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// (a) forecast_lead_time.json: issue day D with earliest_critical_k === 1
// means the GFS run issued D 00Z showed Critical for D+1 -> fires on D.
// k = 2/3 are beyond the rule's today-or-tomorrow horizon.
function forecastHits(raw: unknown): Hit[] {
  if (!isRecord(raw) || !Array.isArray(raw.issue_days)) return [];
  return raw.issue_days
    .filter((d): d is Record<string, unknown> => isRecord(d))
    .filter((d) => d.earliest_critical_k === 1 && typeof d.issue === "string" && DATE_RE.test(d.issue))
    .map((d) => ({ date: d.issue as string, level: "emergency", hazard: EITHER_HAZARD, source: "forecast" }));
}

// (b) observed series days: Critical area > 0 for a hazard -> fires that day.
function observedHits(bundle: CcBundle): Hit[] {
  const out: Hit[] = [];
  for (const d of bundle.series?.days ?? []) {
    if (d.kind !== "observed" || !DATE_RE.test(d.date ?? "")) continue;
    const people = count(d.people_critical);
    const slide = count(d.critical_slide_km2);
    const flood = count(d.critical_flood_km2);
    if (slide !== undefined && slide > 0) out.push({ date: d.date, level: "emergency", hazard: "landslide", source: "observed", km2: slide, people });
    if (flood !== undefined && flood > 0) out.push({ date: d.date, level: "emergency", hazard: "flood", source: "observed", km2: flood, people });
  }
  return out;
}

// "A, B, C and N more (places as of <reference date>)" from the priority zones.
export function replayPlaces(bundle: CcBundle): string {
  const names: string[] = [];
  const rows = (bundle.zones?.features ?? [])
    .map((f) => (f.properties ?? {}) as Record<string, unknown>)
    .filter((p) => typeof p.rank === "number" && Number.isFinite(p.rank) && typeof p.name === "string" && p.name)
    .sort((a, b) => (a.rank as number) - (b.rank as number));
  for (const p of rows) if (!names.includes(p.name as string)) names.push(p.name as string);
  const asOf = bundle.reference_date ? ` (places as of ${fmtDate(bundle.reference_date)})` : "";
  if (names.length === 0) return `${bundle.title}${asOf}`;
  const top = names.slice(0, 3).join(", ");
  const more = names.length > 3 ? ` and ${names.length - 3} more` : "";
  return `${top}${more}${asOf}`;
}

// Collapse runs of consecutive days at the same level + hazard + basis into
// the run's first day.
function collapse(hits: Hit[]): { first: Hit; through: string }[] {
  const key = (h: Hit) => `${h.source}|${h.level}|${h.hazard}`;
  const sorted = [...hits].sort((a, b) => a.date.localeCompare(b.date) || key(a).localeCompare(key(b)));
  const open = new Map<string, { first: Hit; through: string }>();
  const runs: { first: Hit; through: string }[] = [];
  for (const h of sorted) {
    const run = open.get(key(h));
    if (run && addDays(run.through, 1) === h.date) {
      run.through = h.date;
      continue;
    }
    const next = { first: h, through: h.date };
    open.set(key(h), next);
    runs.push(next);
  }
  return runs.sort((a, b) => a.first.date.localeCompare(b.first.date));
}

export function replayAlerts(bundle: CcBundle | undefined): ReplayAlert[] {
  if (!bundle || bundle.mode !== "replay") return [];
  const region = replayPlaces(bundle);
  return collapse([...forecastHits(bundle.forecastLeadTime), ...observedHits(bundle)]).map(({ first: h, through }) => {
    const basis = h.source === "forecast" ? forecastBasis(h.date) : OBSERVED_BASIS;
    const still = through !== h.date ? `still Critical through ${fmtDate(through)}` : undefined;
    const people = h.people !== undefined ? `${h.people.toLocaleString("en-US")} people in Critical areas (estimate)` : undefined;
    const detail = [people, still].filter(Boolean).join(" · ");
    return {
      id: `replay-${h.source}-${h.hazard}-${h.date}`,
      date: h.date,
      through,
      source: h.source,
      title: `Replay: CRITICAL ${h.hazard} risk`,
      area: region,
      region,
      hazard: h.hazard,
      level: h.level,
      certainty: "medium",
      when: h.source === "forecast" ? "d1" : "today",
      ...(h.km2 !== undefined ? { area_km2: h.km2 } : {}),
      ...(detail ? { rain: detail } : {}),
      valid_from: h.date,
      valid_to: h.source === "forecast" ? addDays(through, 1) : through,
      guidance: `Raised on ${fmtDate(h.date)} from the ${basis} TPI.`,
    };
  });
}

// Alerts dated on or before the selected step; the rest are counted.
export function replayAlertsAt(bundle: CcBundle | undefined, stepDate: string | undefined): ReplayAlertList {
  const all = replayAlerts(bundle);
  const at = stepDate?.slice(0, 10);
  const shown = at ? all.filter((a) => a.date <= at) : all;
  return { shown, later: all.length - shown.length };
}

export const replayLaterText = (n: number): string | undefined =>
  n > 0 ? `${n} more later in the replay` : undefined;
