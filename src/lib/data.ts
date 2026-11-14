// Server-side loader for the v4 data contract (SCHEMA.md).
// Files default to the raw fallback branch, an orphan branch force-pushed each run.
// DATA_BASE_URL overrides it; bundled public/data synced by `bun run sync:data` is last resort.
// Any remote miss falls back to the bundled copy and flags the bundle.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import {
  canonicalCaseId,
  caseAlias,
  resolveAsset,
  toMetricsView,
  toNowView,
  type MetricsView,
  type NowAlertsFile,
  type NowSummary,
  type NowView,
} from "./contract";
import type { LayerMeta } from "./ee-layers";
import type {
  AlertsFile,
  CaseBundle,
  DayPoint,
  EventManifest,
  EventMetrics,
  EventsIndex,
  NisarPass,
  RootManifest,
  SeriesDaily,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

export interface LoadedCaseBundle extends CaseBundle {
  // True when a remote read failed and at least one file came from disk —
  // the bundle is a mix of raw fallback branch data and the bundled copy.
  // Also true when GEE creds exist but the live overlay degraded (every call
  // failed, or the layer probe answered with nothing published).
  fallback?: boolean;
  // now/ critical-area polygons (products.critical_areas or fixed name).
  criticalAreas?: GeoJSON.FeatureCollection;
  // Upcoming NISAR passes for the live bundle (hoisted by toNowView).
  nisarPasses?: NisarPass[];
  // Live GEE layer metadata (L8); present when the probe answered, even
  // when the layers array is empty (GEE up, nothing published).
  liveLayers?: LayerMeta[];
  // 'gee' when at least one live call contributed content, 'static' when
  // credentialed but nothing live applied, undefined when not credentialed.
  dataSource?: "gee" | "static";
  // numbers.data_date when live numbers applied. The front renders
  // "Showing last saved data from <updated_at ?? dataDate>" on fallback.
  dataDate?: string;
}

// Optional test/injection seam for the live GEE overlay (L8). When `gee` is
// provided its functions are used as-is and the credential gate is skipped —
// presence of an injected gee means "credentialed".
export interface CaseBundleOpts {
  gee?: {
    numbers?: (q: { caseId: string; date: string }) => Promise<unknown>;
    layers?: (caseId: string) => Promise<unknown>;
  };
}

// products map values are strictly string | null; null = absent.
type Products = Record<string, string | null | undefined>;

interface ReadCtx {
  base?: string;
  fellBack: boolean;
}

const remoteBase = () =>
  (process.env.DATA_BASE_URL ||
    "https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data").replace(/\/+$/, "");

const newCtx = (): ReadCtx => ({ base: remoteBase(), fellBack: false });

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

// Remote fetch inside `use cache` so raw fallback branch reads share the "minutes"
// profile; the directive is inert under `bun test`, where cacheLife has no
// cache scope to configure.
async function fetchJson<T>(url: string): Promise<T> {
  "use cache";
  try {
    cacheLife("minutes");
  } catch {
    // outside a `use cache` scope (tests) there is no cache to configure
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`data fetch ${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function readFs<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await readFile(path.join(DATA_DIR, key), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

// One logical file: raw fallback branch or DATA_BASE_URL override first,
// then the last-resort bundled copy under public/data. `p` is
// data-root-relative ("rs_2024/geojson/...") or dir-relative ("geojson/..."),
// per resolveAsset.
async function readData<T>(
  ctx: ReadCtx,
  dir: string,
  p: string
): Promise<T | undefined> {
  const url = resolveAsset(ctx.base ?? "", dir, p);
  if (url === undefined) return undefined;
  if (ctx.base || /^https?:\/\//i.test(url)) {
    const remote = await fetchJson<T>(url).catch(() => undefined);
    if (remote !== undefined) return remote;
    if (!ctx.base) return undefined; // absolute URL, nothing local to try
    ctx.fellBack = true;
  }
  const key = resolveAsset("", dir, p);
  return key === undefined || /^https?:\/\//i.test(key)
    ? undefined
    : readFs<T>(key);
}

// products map first (null -> absent), fixed filename fallback.
const loadProduct = <T>(
  ctx: ReadCtx,
  dir: string,
  products: Products | undefined,
  key: string,
  fixed: string
): Promise<T | undefined> => {
  const declared = products?.[key];
  if (declared === null) return Promise.resolve(undefined);
  return readData<T>(ctx, dir, declared ?? fixed);
};

const must = async <T>(
  pending: Promise<T | undefined>,
  what: string
): Promise<T> => {
  const v = await pending;
  if (v === undefined) throw new Error(`data: ${what} not found`);
  return v;
};

// Dirs on disk are the canonical underscore case keys (L4); the hyphen
// event id only names events.json entries and payload `event` fields.
// Legacy synced data may still live under the hyphen dir — try both.
const dirsFor = (id: string): string[] => {
  const canonical = canonicalCaseId(id);
  return [...new Set([canonical, caseAlias(canonical)].filter(Boolean))] as string[];
};

const firstOf = async <T>(
  ctx: ReadCtx,
  dirs: string[],
  rel: string
): Promise<T | undefined> => {
  for (const dir of dirs) {
    const v = await readData<T>(ctx, dir, rel);
    if (v !== undefined) return v;
  }
  return undefined;
};

// metrics ref: "metrics.json#<case>" indexes the root metrics file; a bare
// path points at a flat per-case metrics.json (legacy shape).
async function loadMetrics(
  ctx: ReadCtx,
  ref: string | undefined,
  dirs: string[]
): Promise<EventMetrics | undefined> {
  if (ref) {
    const [p, frag] = ref.split("#", 2);
    const doc = await readData<Record<string, unknown>>(ctx, "", p);
    if (doc !== undefined) {
      if (!frag) return doc as unknown as EventMetrics;
      const cases = isRecord(doc.cases) ? doc.cases : undefined;
      const node = cases?.[frag];
      if (isRecord(node)) return node as unknown as EventMetrics;
      // fragment missing -> try legacy per-case reads below
    }
  }
  return firstOf<EventMetrics>(ctx, dirs, "metrics.json");
}

export const getEventsIndex = () =>
  must(readData<EventsIndex>(newCtx(), "", "events.json"), "events.json");

// v4 contract: a single root manifest.json maps every case (incl. `now`) to
// { event_id, mode, bounds, layers[], metrics, products, data_dates }.
export const getRootManifest = () =>
  readData<RootManifest>(newCtx(), "", "manifest.json");

export const getManifest = (id: string) =>
  must(
    firstOf<EventManifest>(newCtx(), dirsFor(id), "manifest.json"),
    `${id}/manifest.json`
  );

export const getMetrics = async (id: string) => {
  const ctx = newCtx();
  const dirs = dirsFor(id);
  const root = await readData<RootManifest>(ctx, "", "manifest.json");
  const entry = root?.cases?.[dirs[0]] ?? root?.cases?.[id];
  const metrics = await loadMetrics(
    ctx,
    entry?.metrics ?? `metrics.json#${dirs[0]}`,
    dirs
  );
  if (metrics === undefined) throw new Error(`data: metrics for ${id} not found`);
  return metrics;
};

export const getSeries = (id: string) =>
  must(
    firstOf<SeriesDaily>(newCtx(), dirsFor(id), "series/imerg_smap_daily.json"),
    `${id}/series/imerg_smap_daily.json`
  );

export const getAlerts = () =>
  must(readData<AlertsFile>(newCtx(), "", "alerts.json"), "alerts.json");

// now@2 has no series file — the timeline comes from the manifest's layer
// dates; the forecast flag marks D+1..D+3. Used only when no series file
// resolves for the live bundle.
function nowSeriesFromLayers(
  view: NowView,
  reference_date: string
): SeriesDaily | undefined {
  const dated = view.layers.filter((l) => l.date);
  if (!dated.length) return undefined;
  const dates = [...new Set(dated.map((l) => l.date as string))].sort();
  const observed = dates.filter((d) =>
    dated.some((l) => l.date === d && !l.forecast)
  );
  const ref = observed[observed.length - 1] ?? reference_date;
  const refMs = Date.parse(`${ref}T00:00:00Z`);
  const days: DayPoint[] = dates.map((date) => ({
    date,
    offset: Math.round((Date.parse(`${date}T00:00:00Z`) - refMs) / 86_400_000),
    kind: observed.includes(date) ? "observed" : "forecast",
    imerg_mm: 0,
    smap: 0,
    tpi: 0,
    river_m: null,
  }));
  return { event: "now", reference_date: ref, days };
}

// One case = one entry in the root manifest's `cases` map (canonical
// underscore keys; caseAlias maps the hyphen event ids used by events.json),
// backed by a directory under public/data/<case-key>. Legacy per-case
// manifest.json files still resolve when the root manifest doesn't list the
// case — hyphen-named legacy dirs are tried after the canonical one.
export async function getCaseBundle(
  id: string,
  title: string,
  bbox: [number, number, number, number],
  reference_date: string,
  opts?: CaseBundleOpts
): Promise<LoadedCaseBundle> {
  const ctx = newCtx();
  const dirs = dirsFor(id);
  const canonical = dirs[0];

  const root = await readData<RootManifest>(ctx, "", "manifest.json");
  const entry = root?.cases?.[canonical] ?? root?.cases?.[id];

  // The legacy per-case manifest is only needed when the root node is
  // missing pieces the merge falls back on.
  const needPerCase =
    !entry || !entry.layers || !entry.products || !entry.data_dates;
  const perCase = needPerCase
    ? await firstOf<EventManifest>(ctx, dirs, "manifest.json")
    : undefined;

  // The `now` node arrives verbatim (schema tipping-point/now@2) — normalize
  // it; replay nodes keep the merged manifest view.
  const now =
    canonical === "now" ? toNowView(entry ?? perCase) : undefined;

  const manifest: EventManifest | undefined = now
    ? {
        event: "now",
        mode: "live",
        bounds: now.bounds ?? perCase?.bounds,
        updated_at: now.updated_at ?? root?.updated_at,
        data_dates: now.data_dates as EventManifest["data_dates"],
        layers: now.layers,
        products: now.products,
        forecast_source: now.forecast_source,
      }
    : entry
      ? {
          event: entry.event_id ?? perCase?.event ?? canonical,
          event_id: entry.event_id,
          mode: entry.mode ?? perCase?.mode,
          bounds: entry.bounds ?? perCase?.bounds,
          updated_at:
            entry.updated_at ?? root?.updated_at ?? perCase?.updated_at,
          data_dates: entry.data_dates ?? perCase?.data_dates,
          layers: entry.layers ?? perCase?.layers ?? [],
          products: entry.products ?? perCase?.products,
          forecast_source:
            entry.forecast_source ?? perCase?.forecast_source,
        }
      : perCase;

  // In remote mode layer png/cog paths resolve to raw fallback branch URLs; on disk they
  // stay data-root-relative (/data/... via resolveDataUrl).
  if (ctx.base && manifest?.layers) {
    manifest.layers = manifest.layers.map((l) => ({
      ...l,
      png: resolveAsset(ctx.base!, canonical, l.png) ?? l.png,
      cog: resolveAsset(ctx.base!, canonical, l.cog) ?? l.cog,
    }));
  }

  // Load decisions use the raw products map so explicit nulls mean "absent"
  // (toNowView exposes a strings-only map on the bundle manifest).
  const rawProducts = (
    now ? (entry ?? perCase)?.products : manifest?.products
  ) as Products | undefined;
  const geo = (key: string, fixed: string) =>
    loadProduct<GeoJSON.FeatureCollection>(ctx, canonical, rawProducts, key, fixed);

  // --- live GEE overlay (L8) ------------------------------------------------
  // Injected gee (tests) skips the credential gate; otherwise the helpers load
  // via dynamic import so this module has no static edge to ee-* (they import
  // getRootManifest from here) and ee stays off the no-creds path entirely.
  let gee = opts?.gee;
  if (!gee && (process.env.GCP_SA_KEY || process.env.GEE_SERVICE_ACCOUNT_KEY)) {
    const [eeMod, numbersMod, layersMod] = await Promise.all([
      import("./ee"),
      import("./ee-numbers"),
      import("./ee-layers"),
    ]);
    if (eeMod.credentialEnv()) {
      gee = {
        numbers: (q) => numbersMod.getNumbers(q),
        layers: (c) => layersMod.getLayerMeta(c),
      };
    }
  }
  const credentialed = Boolean(gee);

  // Numbers query date: replay cases use the reference date; the live `now`
  // case wants the latest observed data date — the d0 layer date, else
  // data_dates.observed, else the reference date.
  const d0Date = now?.layers.find(
    (l) => /_d0$/.test(l.id) && typeof l.date === "string"
  )?.date;
  const observedDate =
    now?.data_dates && typeof now.data_dates.observed === "string"
      ? now.data_dates.observed
      : undefined;
  const numbersDate =
    canonical === "now"
      ? (d0Date ?? observedDate ?? reference_date)
      : reference_date;

  // One slow/failed call must not hang the other — the helpers carry their
  // own internal timeouts.
  const livePending = gee
    ? Promise.allSettled([
        gee.numbers?.({ caseId: canonical, date: numbersDate }),
        gee.layers?.(canonical),
      ])
    : undefined;

  const [
    metrics,
    series,
    swot,
    zones,
    water,
    flood,
    scars,
    places,
    catalog,
    municipalities,
    summary,
    nowAlerts,
    criticalAreas,
  ] = await Promise.all([
    loadMetrics(ctx, entry?.metrics ?? `metrics.json#${canonical}`, dirs),
    loadProduct<SeriesDaily>(
      ctx,
      canonical,
      rawProducts,
      "imerg_smap_daily",
      "series/imerg_smap_daily.json"
    ),
    loadProduct<unknown>(ctx, canonical, rawProducts, "swot", "series/swot.json"),
    geo("priority_zones", "geojson/priority_zones.geojson"),
    geo("permanent_water", "geojson/permanent_water.geojson"),
    geo("flood_confirmed", "geojson/flood_confirmed.geojson"),
    geo("landslide_candidates", "geojson/landslide_candidates.geojson"),
    geo("places", "geojson/places.geojson"),
    geo("landslide_catalog", "geojson/landslide_catalog.geojson"),
    geo("municipal_boundaries", "geojson/municipal_boundaries.geojson"),
    now
      ? loadProduct<NowSummary>(ctx, canonical, rawProducts, "summary", "summary.json")
      : undefined,
    now
      ? loadProduct<NowAlertsFile>(ctx, canonical, rawProducts, "alerts", "alerts.json")
      : undefined,
    now ? geo("critical_areas", "geojson/critical_areas.geojson") : undefined,
  ]);

  const bundle: LoadedCaseBundle = {
    id,
    title,
    mode: manifest?.mode ?? (now ? "live" : "replay"),
    bbox: manifest?.bounds ?? bbox,
    reference_date,
    updated_at: manifest?.updated_at,
    data_dates: manifest?.data_dates,
    manifest,
    metrics,
    metricsView: toMetricsView(metrics),
    summary,
    nowAlerts,
    criticalAreas,
    nisarPasses: now?.nisar_passes,
    swot,
    catalog,
    municipalities,
    products: manifest?.products,
    series: series ?? (now ? nowSeriesFromLayers(now, reference_date) : undefined),
    zones,
    water,
    flood,
    scars,
    places,
    fallback: ctx.fellBack,
  };

  // Apply whatever the live GEE calls returned (L8). Numbers overlay the
  // metricsView/summary fields; layer meta lands on liveLayers. An answered
  // but EMPTY layers array means GEE is up yet nothing is published —
  // degraded, not content.
  const [numbersSettled, layersSettled] = (await livePending) ?? [];
  const numbers =
    numbersSettled?.status === "fulfilled" && isRecord(numbersSettled.value)
      ? numbersSettled.value
      : undefined;
  const layerResult =
    layersSettled?.status === "fulfilled" && isRecord(layersSettled.value)
      ? layersSettled.value
      : undefined;
  const liveLayers = Array.isArray(layerResult?.layers)
    ? (layerResult.layers as LayerMeta[])
    : undefined;
  const layersEmpty = liveLayers !== undefined && liveLayers.length === 0;
  if (liveLayers) bundle.liveLayers = liveLayers;

  let numbersApplied = false;
  if (numbers) {
    const mv: MetricsView = { ...(bundle.metricsView ?? {}) };
    const peopleExposed = num(numbers.people_exposed);
    const floodedKm2 = num(numbers.flooded_km2);
    const peopleFlooded = num(numbers.people_flooded);
    const km2Critical = num(numbers.km2_critical);
    if (peopleExposed !== undefined) mv.people_critical = peopleExposed;
    if (floodedKm2 !== undefined) {
      mv.flooded_km2 = floodedKm2;
      // The live flood asset is NISAR GCOV per contract.
      mv.flood_source = "nisar";
    }
    if (peopleFlooded !== undefined) mv.people_flooded = peopleFlooded;
    bundle.metricsView = mv;
    if (bundle.summary) {
      if (km2Critical !== undefined)
        bundle.summary = {
          ...bundle.summary,
          critical_km2: { ...bundle.summary.critical_km2, any: km2Critical },
        };
      if (peopleExposed !== undefined)
        bundle.summary = {
          ...bundle.summary,
          people_exposed: peopleExposed,
          people_critical: peopleExposed,
        };
    }
    if (typeof numbers.data_date === "string")
      bundle.dataDate = numbers.data_date;
    numbersApplied = true;
  }

  const anyContent = numbersApplied || Boolean(liveLayers?.length);
  const attempted = Boolean(gee?.numbers || gee?.layers);
  if (credentialed) bundle.dataSource = anyContent ? "gee" : "static";
  // Credentialed-but-degraded (all live calls failed, or the probe answered
  // with zero published layers) counts as stale: the user sees last-good
  // static although live was expected. No creds -> not stale, just offline.
  bundle.fallback =
    ctx.fellBack || (credentialed && (layersEmpty || (attempted && !anyContent)));

  return bundle;
}
