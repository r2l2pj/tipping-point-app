import { Suspense } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import { canonicalCaseId } from "@/lib/contract";
import { getAlerts, getCaseBundle, getEventsIndex, getMlArtifacts, getRootManifest } from "@/lib/data";
import { resolveAsset } from "@/lib/contract";
import type { ManifestLayer } from "@/lib/types";
import { buildMlView, groupImportance } from "./model/ml";
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

// Layer fields the screen never reads: the per-layer legend, `kind`, and
// `forecast_source` on GFS frames (isGfsFrame knows them by id).
const GFS_ID = /_gfs_d[1-3]$/;
function slimLayer(layer: NonNullable<CcBundle["manifest"]>["layers"][number]) {
  const { legend: _legend, ...rest } = layer as typeof layer & { kind?: unknown };
  const out = { ...rest } as Record<string, unknown>;
  delete out.kind;
  if (GFS_ID.test(layer.id)) delete out.forecast_source;
  return out as unknown as typeof layer;
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
    const view = buildMlView(ml.card, canonicalCaseId(bundle.id));
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
  if (!isLive) return { ...bundle, manifest, zones };
  const passes = nisarPasses(bundle);
  return {
    ...bundle,
    manifest,
    zones,
    // The observed list (97 entries on 2026-11-15) is reduced here to the
    // per-source cards the public view shows; the raw list stays server-side.
    observedSummary: observedRows(bundle),
    nowAlerts: bundle.nowAlerts ? { ...bundle.nowAlerts, candidates: [], observed: undefined } : undefined,
    nisarPasses: passes.slice(0, PASSES_SHOWN),
    nisarPassCount: passes.length,
  };
}

// Loads the case bundles and builds the alert list once, on the server, for
// both routes (/ and /alerts). The alert list is built here because
// candidatesToAlerts reads the clock when no issue time is given.
type Search = Promise<{ case?: string; day?: string }> | undefined;

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
  const cases: CcBundle[] = [];
  eventBundles.forEach((bundle, i) => {
    if (bundle) cases.push({ ...bundle, nullReasons: nullReasons(root, events[i].id) });
  });
  // Run time of the live case: the `updated_at` of the live node itself. The
  // loader falls back to the root manifest time, which is the time of the
  // data snapshot and would make an empty live seed read as a fresh run.
  const live: CcBundle | null = now?.manifest
    ? { ...now, updated_at: liveRunTime(root), nullReasons: nullReasons(root, "now") }
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
  const slim = cases.map((c) => {
    const b = toClientBundle(withMl(c, mlArtifacts), c === live);
    return c === live && riskPaused ? { ...b, riskPaused: true } : b;
  });

  return (
    <CommandCenter
      cases={slim}
      alertList={alertList}
      botUrl={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || undefined}
      fontClass={fontClass}
      initialCase={initialCase}
      initialDay={initialDay}
    />
  );
}

// `searchParams` carries the `?case=<id|alias>&day=<offset or date>` deep link (judge
// and demo links): the screen opens on that case and day instead of Now.
export default function CommandCenterLoader({ searchParams }: { searchParams?: Search }) {
  return (
    <Suspense
      fallback={
        <div className={`cc-root flex h-screen items-center justify-center text-sm ${fontClass}`}>
          Loading data…
        </div>
      }
    >
      <Loaded searchParams={searchParams} />
    </Suspense>
  );
}
