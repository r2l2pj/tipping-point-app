// Maps now/alerts.json candidates (NowAlertCandidate: class/label/centroid/
// pixels/hold) onto the Alert card shape the /alerts page renders — the same
// "Mensagem de alerta" format the Telegram bot sends (project doc v4). Pure
// helpers, no next/maplibre imports, so they run under `bun test`.

import type { NowAlertCandidate } from "./contract";
import { nearestPlace } from "./tpi";
import type { Alert, AlertLevel } from "./types";

// Alert plus the fields the /alerts card needs that alerts@1 doesn't carry:
// the rendered message title and the quiet-hours flags.
export interface AlertCardData extends Alert {
  title?: string;
  held?: boolean; // held by the quiet-hours rule (23:00–06:00 BRT)
  quiet?: boolean; // issued during quiet hours — Critical still goes out
}

export interface AlertsContext {
  places?: GeoJSON.FeatureCollection;
  issuedAt?: Date | string; // issue time; defaults to now
  dataDates?: Record<string, string>; // passthrough onto Alert.data_dates
}

// Badge word per level — shared by the generated message title and the card
// heading so both always match.
export const ALERT_LEVEL_WORDS: Record<AlertLevel, string> = {
  emergency: "CRITICAL",
  warning: "HIGH",
  watch: "ELEVATED",
};

export const ALERT_FOOTER = "Follow Civil Defense guidance. SMS 40199.";

// Candidate `class` arrives either as the 0-3 class index (2 = Alto, 3 =
// Crítico) or as a raw 0-1 TPI float. Integers read as class indices;
// fractional values read as TPI on the same 0.4/0.6 class edges. Only
// Alto/Crítico upgrade to an alert — anything lower is suppressed.
export function levelForClass(c: number | undefined): AlertLevel | undefined {
  if (typeof c !== "number" || !Number.isFinite(c)) return undefined;
  if (Number.isInteger(c)) {
    if (c === 3) return "emergency";
    if (c === 2) return "warning";
    return undefined;
  }
  if (c >= 0.6 && c <= 1) return "emergency";
  if (c >= 0.4 && c < 0.6) return "warning";
  return undefined;
}

const brtHour = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hour: "numeric",
  hourCycle: "h23",
});

// Quiet-hours rule (project doc: never send between 23h and 6h BRT unless the
// class is Crítico). Alerts raised inside the window are held; Crítico still
// goes out but is flagged.
export function isQuietHourBRT(d: Date): boolean {
  const h = Number(brtHour.format(d)) % 24;
  return Number.isFinite(h) && (h >= 23 || h < 6);
}

// 'held' display label for the card badge. Accepts a raw NowAlertCandidate
// (`hold`) or a generated AlertCardData (`held`).
export function heldLabel(a: {
  hold?: boolean;
  held?: boolean;
}): string | undefined {
  return a.hold === true || a.held === true ? "held" : undefined;
}

const hazardFor = (label?: string): string => {
  const t = label?.toLowerCase() ?? "";
  if (/flood|enchente|inunda/.test(t)) return "flood";
  return "landslide"; // deslizamento/slide keywords and the default
};

const certaintyFor = (pixels?: number): Alert["certainty"] =>
  (pixels ?? 0) >= 50 ? "high" : (pixels ?? 0) >= 10 ? "medium" : "low";

// now.data_dates mixes strings, nulls and NisarPass[]; Alert.data_dates is
// string-only — keep just the string entries.
export function alertDataDates(
  dd: Record<string, unknown> | undefined
): Record<string, string> | undefined {
  if (!dd) return undefined;
  const out = Object.fromEntries(
    Object.entries(dd).filter(([, v]) => typeof v === "string")
  ) as Record<string, string>;
  return Object.keys(out).length ? out : undefined;
}

// NowAlertCandidate[] -> Alert[]. Candidates below Alto are skipped. `hold`
// candidates and anything raised during quiet hours carry the held flag;
// Crítico raised during quiet hours is still emitted, flagged `quiet`.
export function candidatesToAlerts(
  candidates: NowAlertCandidate[] | undefined,
  ctx: AlertsContext = {}
): AlertCardData[] {
  const issued = ctx.issuedAt ? new Date(ctx.issuedAt) : new Date();
  const validTo = new Date(issued.getTime() + 12 * 3600 * 1000);
  const quiet = isQuietHourBRT(issued);

  const out: AlertCardData[] = [];
  (candidates ?? []).forEach((c, i) => {
    const level = levelForClass(c.class);
    if (!level) return;

    const hazard = hazardFor(c.label);
    const held = c.hold === true || (quiet && level === "warning");
    const quietFlag = quiet && level === "emergency";
    const region =
      (c.centroid
        ? nearestPlace(ctx.places, c.centroid[0], c.centroid[1])
        : undefined) ?? "monitored region";
    const advice =
      hazard === "flood"
        ? "Stay away from riverbanks and flooded streets"
        : "Stay away from steep slopes and riverbanks";
    const urgency =
      level === "emergency"
        ? "; be ready to leave if Civil Defense orders it"
        : "";
    const notes = held
      ? " Held by the quiet-hours rule (23:00–06:00 BRT)."
      : quietFlag
        ? " Issued during quiet hours — Critical alerts always go out."
        : "";

    out.push({
      id: `now-${i}-${hazard}-${level}`,
      title: `Tipping Point: ${ALERT_LEVEL_WORDS[level]} ${hazard} risk`,
      area: region,
      region,
      hazard,
      level,
      certainty: certaintyFor(c.pixels),
      held,
      quiet: quietFlag,
      valid_from: issued.toISOString(),
      valid_to: validTo.toISOString(),
      guidance:
        `${ALERT_LEVEL_WORDS[level]} ${hazard} risk in your region. ` +
        `${advice}${urgency}.${notes} ${ALERT_FOOTER}`,
      data_dates: ctx.dataDates,
    });
  });
  return out;
}
