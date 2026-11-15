// L43: "Next NISAR look (expected): <date BRT> (track N)" — when the radar will
// next see (12-day repeat from the last pass, no tasking plan: expected, not
// guaranteed)
// a place (lead-analysis data/now/nisar_next_passes.json and the zone/alert
// fields next_nisar_pass_utc / next_nisar_track). Hidden when absent.
import { fmtBrt } from "./format";

type M = Record<string, unknown>;
const isRecord = (v: unknown): v is M => typeof v === "object" && v !== null && !Array.isArray(v);

export interface NextPass { utc: string; track?: string }

export const NISAR_FRAMING = "Forecast says where risk is rising; NISAR shows when radar will check it.";

// First pass still ahead of `now` from the published list.
export function nextPassFrom(raw: unknown, now = Date.now()): NextPass | undefined {
  const list = isRecord(raw) && Array.isArray(raw.passes) ? raw.passes : Array.isArray(raw) ? raw : [];
  return list
    .filter(isRecord)
    .map((p) => ({ utc: String(p.utc ?? p.time ?? p.acquired ?? ""), track: p.track != null ? String(p.track) : undefined }))
    .filter((p) => !Number.isNaN(Date.parse(p.utc)) && Date.parse(p.utc) > now)
    .sort((a, b) => Date.parse(a.utc) - Date.parse(b.utc))[0];
}

// A zone or alert's own next pass (next_nisar_pass_utc / next_nisar_track).
export function nextPassOf(p: unknown): NextPass | undefined {
  if (!isRecord(p) || typeof p.next_nisar_pass_utc !== "string" || Number.isNaN(Date.parse(p.next_nisar_pass_utc))) return undefined;
  return { utc: p.next_nisar_pass_utc, track: p.next_nisar_track != null ? String(p.next_nisar_track) : undefined };
}

export const nextLookText = (n: NextPass | undefined): string | undefined =>
  n ? `Next NISAR look (expected): ${fmtBrt(n.utc)}${n.track ? ` (track ${n.track})` : ""}` : undefined;
