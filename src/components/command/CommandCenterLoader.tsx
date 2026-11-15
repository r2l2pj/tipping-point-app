import { featuredFirst } from "./state";
import { Suspense } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import { canonicalCaseId } from "@/lib/contract";
import { getAlerts, getCaseBundle, getDataJson, getEventsIndex, getMlArtifacts, getRootManifest } from "@/lib/data";
import { slimHypothesis, slimNisarSeries } from "./model/nisarSeries";
import { nextPassFrom } from "./model/nextPass";
import { resolveAsset } from "@/lib/contract";
import type { ManifestLayer } from "@/lib/types";
import { buildMlView, groupImportance } from "./model/ml";
import { compactLayerUrls } from "./model/layerUrls";
import CommandCenter from "./CommandCenter";
import { alertsPaused, buildAlertList, capAlertList, observedRows, pausedAlertList, runVerified } from "./model/alerts";
import { nisarPasses, PASSES_SHOWN } from "./model/radar";
import type { CcBundle } from "./model/types";

const body = Inter({ variable: "--cc-font-body", subsets: ["latin"] });
const display = Space_Grotesk({ variable: "--cc-font-display", subsets: ["latin"], weight: ["600", "700"] });
const fontClass = `${body.variable} ${display.variable}`;

const NOW_BBOX: [number, number, number, number] = [-58, -34, -48, -22.5];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

// `_null_reasons` of a case node: why a product is null. The loader in
// src/lib does not carry it, so it is read from the root manifest here.
function nullReasons(root: unknown, id: string): Record<string, string> | undefined {
  const cases = isRecord(root) && isRecord(root.cases) ? root.cases : undefined;
  const node = cases?.[canonicalCaseId(id)] ?? cases?.[id];
  const reasons = isRecord(node) ? node._null_reasons : undefined;
  if (!isRecord(reasons)) return undefined;
  const out = Object.fromEntries(
    Object.entries(reasons).filter(([, v]) => typeof v === "string")
  ) as Record<string, string>;
  return Object.keys(out).length ? out : undefined;
}

// The live node's flags: the root manifest's `now` node, else the per-case
// now/manifest.json (lead-live writes `verified` / `alerts_paused`).
function liveNode(root: unknown, manifest: unknown): Record<string, unknown> | undefined {
  const cases = isRecord(root) && isRecord(root.cases) ? root.cases : undefined;
  const node = isRecord(cases?.now) ? cases.now : undefined;
  const own = isRecord(manifest) ? manifest : undefined;
  if (!node && !own) return undefined;
  return { ...own, ...node };
}

function liveRunTime(root: unknown): string | undefined {
  const cases = isRecord(root) && isRecord(root.cases) ? root.cases : undefined;
  const node = cases?.now;
  return isRecord(node) && typeof node.updated_at === "string" ? node.updated_at : undefined;
}

// Zone properties the screen never reads (R3 municipalities carry the IBGE
// licence and source URL on every feature).
const ZONE_DROP = ["license", "url", "source", "code"];
const slimZones = (fc: CcBundle["zones"]): CcBundle["zones"] =>
  fc && {
    ...fc,
    features: fc.features.map((f) => ({
      ...f,
      properties: Object.fromEntries(
        Object.entries(f.properties ?? {}).filter(([k]) => !ZONE_DROP.includes(k))
      ),
    })),
  };

// Layer fields the screen never reads: the per-layer legend (but see KEEP_LEGEND), `kind`,
// `forecast_source` on GFS frames (isGfsFrame knows them by id), and the
// descriptive fields of P(trigger) frames (basis_label and low_skill stay).
const GFS_ID = /_gfs_d[1-3]$/;
const PTRIGGER_DROP = ["title", "serve_note", "domain", "model", "obs_days", "forecast_days",
  "horizon_days", "obs_through", "gfs_issued", "basis", "partly_forecast"];
// Kept: the rain legend (its stops are the colors of the re-rendered PNG)
// and hand_low's swatch color.
const KEEP_LEGEND = (id: string) => id.startsWith("imerg") || id === "hand_low";
function slimLayer(layer: NonNullable<CcBundle["manifest"]>["layers"][number]) {
  const out = { ...layer } as Record<string, unknown>;
  if (!KEEP_LEGEND(layer.id)) delete out.legend;
  delete out.kind;
  if (GFS_ID.test(layer.id)) delete out.forecast_source;
  if (layer.id.startsWith("p_trigger")) for (const k of PTRIGGER_DROP) delete out[k];
  return out as unknown as typeof layer;
}

// metricsView keys the screen never reads (lead-ml / lead-analysis detail).
const METRICS_DROP = ["landslide_ml", "lead_time_asavail", "scar_sensitivity", "scar_sensitivity_note",
  "scar_method", "collections", "t_ml_note"];

// lead-analysis "Did the alert come before?" objects carry per-issue and
// per-date curves; the browser needs only the denominators and the text.
const WARNED_OBJECTS = ["flood_warned", "slide_warned"];
const WARNED_KEEP = ["n_points", "confirmed_flood_km2", "explanation", "anchor_utc", "anchor_basis", "anchor_local", "anchor_label", "anchor_short", "unit"];
function slimWarned(v: unknown): unknown {
  if (!isRecord(v)) return v;
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(v).filter(([k]) => WARNED_KEEP.includes(k)));
  // The runs up to 72 h before the damage, three fields each (L36: the
  // 24, 48 and 72 h runs side by side — single runs vary).
  if (Array.isArray(v.by_issue_gfs)) {
    out.by_issue_gfs = v.by_issue_gfs
      .filter((r): r is Record<string, unknown> => isRecord(r) && typeof r.hours_before_anchor === "number" && r.hours_before_anchor < 73)
      .map((r) => ({ issue: r.issue, hours_before_anchor: r.hours_before_anchor, alto_or_critico_pct: r.alto_or_critico_pct }));
  }
  // L37 by_lead {24|48|72: {gfs: {...}}}: the one run per lead the row prints.
  if (isRecord(v.by_lead)) {
    out.by_lead = Object.fromEntries(Object.entries(v.by_lead).map(([k, x]) => {
      const g = isRecord(x) && isRecord(x.gfs) ? x.gfs : undefined;
      return [k, g ? { gfs: { issue: g.issue, hours_before_anchor: g.hours_before_anchor, alto_or_critico_pct: g.alto_or_critico_pct } } : {}];
    }));
  }
  return out;
}

// flood_ems (~40 KB): the row reads the headline, the before-onset shares
// and the scope/licence strings only.
function slimEms(v: unknown): unknown {
  if (!isRecord(v)) return v;
  const b = isRecord(v.flagged_before_onset) ? v.flagged_before_onset : undefined;
  return {
    activation: v.activation, licence: v.licence, coverage_limit: v.coverage_limit,
    headline: isRecord(v.headline) ? { image_date_utc: v.headline.image_date_utc } : undefined,
    flagged_before_onset: b ? Object.fromEntries(Object.entries(b).filter(([k]) =>
      k === "anchor_local" || k.startsWith("observed_band_") || k === "gfs_issued")) : undefined,
  };
}

// imerg_vs_gauge ships a per-station table (stations[]) the screen never
// reads — the rain-check line cites only the medians, the counts and the
// caveat.
function slimGauge(v: unknown): unknown {
  if (!isRecord(v)) return v;
  return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "stations"));
}

// T_ML (lead-ml ml/t_ml.json): one static layer, added as manifest layer
// `t_ml` to every case its bounds overlap (RS Serra region). The PNG path is
// relative to the data root, so it is resolved here to an absolute URL.
function tmlLayer(desc: unknown, base: string | undefined): ManifestLayer | undefined {
  if (!isRecord(desc) || typeof desc.png !== "string" || !Array.isArray(desc.bounds_lonlat)) return undefined;
  const b = desc.bounds_lonlat as number[];
  if (b.length !== 4 || !b.every((v) => typeof v === "number" && Number.isFinite(v))) return undefined;
  const png = base ? resolveAsset(base, "", desc.png) ?? desc.png : desc.png;
  return { id: "t_ml", png, bounds: [b[0], b[1], b[2], b[3]] } as ManifestLayer;
}

const overlaps = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

function withMl(bundle: CcBundle, ml: Awaited<ReturnType<typeof getMlArtifacts>> | null): CcBundle {
  if (!ml) return bundle;
  let out = bundle;
  const tml = tmlLayer(ml.tml, ml.base);
  if (tml && bundle.manifest && overlaps(bundle.bbox, tml.bounds as number[]) &&
      !bundle.manifest.layers.some((l) => l.id === "t_ml")) {
    out = { ...out, manifest: { ...bundle.manifest, layers: [...bundle.manifest.layers, tml] } };
  }
  if (bundle.mode === "replay") {
    const served = isRecord(ml.tml) && typeof ml.tml.model === "string" ? ml.tml.model : undefined;
    const view = buildMlView(ml.card, canonicalCaseId(bundle.id), served);
    const imp = groupImportance(ml.importance);
    out = { ...out, ...(view ? { ml: view } : {}), ...(imp ? { mlImportance: imp } : {}) };
  }
  return out;
}

// The bundle as the browser needs it (A10 page budget).
function toClientBundle(bundle: CcBundle, isLive: boolean): CcBundle {
  const manifest = bundle.manifest
    ? { ...bundle.manifest, layers: bundle.manifest.layers.map(slimLayer) }
    : undefined;
  const zones = slimZones(bundle.zones);
  const metricsView = bundle.metricsView
    ? (Object.fromEntries(Object.entries(bundle.metricsView)
        .filter(([k]) => !METRICS_DROP.includes(k))
        .map(([k, v]) => [k, k === "imerg_vs_gauge" ? slimGauge(v) : WARNED_OBJECTS.includes(k) ? slimWarned(v)
          : k === "flood_ems" ? slimEms(v) : v])) as CcBundle["metricsView"])
    : bundle.metricsView;
  // The raw metrics blob duplicates metricsView; the screen reads only its
  // `_null_reasons` (availability.nullReason).
  const rawMetrics = bundle.metrics as unknown as Record<string, unknown> | undefined;
  const metrics = rawMetrics && typeof rawMetrics === "object"
    ? ({ _null_reasons: rawMetrics._null_reasons } as unknown as CcBundle["metrics"])
    : bundle.metrics;
  if (!isLive) return { ...bundle, manifest, zones, metrics, metricsView };
  const passes = nisarPasses(bundle);
  return {
    ...bundle,
    manifest,
    zones,
    metrics,
    metricsView,
    // The observed list (97 entries on 2026-11-15) is reduced here to the
    // per-source cards the public view shows; the raw list stays server-side.
    observedSummary: observedRows(bundle),
    nowAlerts: bundle.nowAlerts
      ? { ...bundle.nowAlerts, candidates: [], active: undefined, notifications: undefined, observed: undefined }
      : undefined,
    nisarPasses: passes.slice(0, PASSES_SHOWN),
    nisarPassCount: passes.length,
  };
}

// Loads the case bundles and builds the alert list once, on the server, for
// both routes (/ and /alerts). The alert list is built here because
// candidatesToAlerts reads the clock when no issue time is given.
type Search = Promise<{ case?: string; day?: string; lead?: string; compare?: string; before?: string; after?: string; pol?: string; layers?: string; fit?: string; city?: string }> | undefined;

async function Loaded({ searchParams }: { searchParams?: Search }) {
  const search = await searchParams;
  const initialCase = search?.case;
  const initialDay = search?.day || undefined;
  const [index, root, mlArtifacts] = await Promise.all([
    getEventsIndex().catch(() => null),
    getRootManifest().catch(() => undefined),
    getMlArtifacts().catch(() => null),
  ]);
  // All bundles load in parallel: a slow case must not serialize the page
  // stream. A single bad case must not blank the whole screen: skip it.
  // Live case: no reference date is passed, the loader derives it from the
  // data (manifest run time, data dates), never from a fixed date.
  const events = index?.events ?? [];
  const [eventBundles, now] = await Promise.all([
    Promise.all(events.map((e): Promise<CcBundle | null> =>
      getCaseBundle(e.id, e.title, e.bbox, e.reference_date).catch(() => null))),
    (getCaseBundle("now", "Now — Southern Brazil", NOW_BBOX) as Promise<CcBundle | null>).catch(() => null),
  ]);
  // L42: NISAR time series product, only where the case lists it.
  const series = await Promise.all(eventBundles.map((b) => {
    const p = (b?.products as Record<string, unknown> | undefined)?.nisar_timeseries;
    return typeof p === "string" && b
      ? getDataJson(p, canonicalCaseId(b.id)).then(slimNisarSeries).catch(() => undefined)
      : Promise.resolve(undefined);
  }));
  // L42: the double-bounce test next to the series (listed, or the agreed
  // <case>/nisar_hypothesis.json) — only for cases with a NISAR series.
  const hypotheses = await Promise.all(eventBundles.map((b, i) => {
    if (!b || !series[i]) return Promise.resolve(undefined);
    const p = (b.products as Record<string, unknown> | undefined)?.nisar_hypothesis;
    const dir = canonicalCaseId(b.id);
    return getDataJson(typeof p === "string" ? p : "nisar_hypothesis.json", dir).then(slimHypothesis).catch(() => undefined);
  }));
  const cases: CcBundle[] = [];
  eventBundles.forEach((bundle, i) => {
    if (bundle) cases.push({ ...bundle, nullReasons: nullReasons(root, events[i].id),
      ...(series[i] ? { nisarSeries: series[i] } : {}), ...(hypotheses[i] ? { nisarHypothesis: hypotheses[i] } : {}) });
  });
  // Run time of the live case: the `updated_at` of the live node itself. The
  // loader falls back to the root manifest time, which is the time of the
  // data snapshot and would make an empty live seed read as a fresh run.
  // L42: the live NISAR time series (worker nisar-now-ts), same contract as
  // WA; listed in products or at the agreed path, hidden when absent.
  const nowSeriesPath = (now?.products as Record<string, unknown> | undefined)?.nisar_timeseries;
  const nowSeries = now?.manifest
    ? await getDataJson(typeof nowSeriesPath === "string" ? nowSeriesPath : "response/nisar_timeseries.json", "now")
        .then(slimNisarSeries).catch(() => undefined)
    : undefined;
  // L43: next NISAR pass over the live domain (listed product or the agreed path).
  const nextPath = (now?.products as Record<string, unknown> | undefined)?.nisar_next_passes;
  const nisarNext = now?.manifest
    ? await getDataJson(typeof nextPath === "string" ? nextPath : "nisar_next_passes.json", "now")
        .then((raw) => nextPassFrom(raw)).catch(() => undefined)
    : undefined;
  const live: CcBundle | null = now?.manifest
    ? { ...now, updated_at: liveRunTime(root), nullReasons: nullReasons(root, "now"),
        ...(nowSeries ? { nisarSeries: nowSeries } : {}), ...(nisarNext ? { nisarNext } : {}) }
    : null;
  if (live) cases.push(live);

  const legacy = await getAlerts().catch(() => null);
  const built = capAlertList(buildAlertList({ now: live, legacy }));
  const alertList = alertsPaused(liveNode(root, now?.manifest)) ? pausedAlertList(built) : built;

  // Page budget (A10): every byte of `cases` rides in the HTML. The alert
  // candidates were turned into alertList above; the pass list is cut to
  // the cards shown plus its count; per-layer legends are not read.
  // Same verified gate as the alerts: an unverified live run shows no risk
  // map, no risk numbers; radar observations stay.
  const riskPaused = !runVerified(liveNode(root, now?.manifest));
  const slimmed = cases.map((c) => {
    const b = compactLayerUrls(toClientBundle(withMl(c, mlArtifacts), c === live));
    return c === live && riskPaused ? { ...b, riskPaused: true } : b;
  });
  // The ML card's global tables (all TEST events) ride on the first case that
  // has them; other cases keep only their own event rows (the screen merges).
  let sharedMl = false;
  const slim = slimmed.map((b) => {
    if (!b.ml) return b;
    if (!sharedMl) { sharedMl = true; return b; }
    const { event, eventId } = b.ml;
    return { ...b, ml: { event, eventId } as CcBundle["ml"] };
  });

  return (
    <CommandCenter
      cases={featuredFirst(slim)}
      alertList={alertList}
      botUrl={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || undefined}
      fontClass={fontClass}
      initialCase={initialCase}
      initialDay={initialDay}
      initialCity={search?.city || undefined}
      deepLink={{ lead: search?.lead, compare: search?.compare, before: search?.before, after: search?.after, pol: search?.pol, layers: search?.layers, fit: search?.fit }}
    />
  );
}

// `searchParams` carries the `?case=<id|alias>&day=<offset or date>` deep link (judge
// and demo links): the screen opens on that case and day instead of Now.
export default function CommandCenterLoader({ searchParams }: { searchParams?: Search }) {
  return (
    <Suspense
      fallback={
        <main className={`cc-root flex h-screen items-center justify-center text-sm ${fontClass}`}>
          Loading data…
        </main>
      }
    >
      <Loaded searchParams={searchParams} />
    </Suspense>
  );
}
