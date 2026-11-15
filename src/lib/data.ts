// Server-side loader for the v4 data contract (SCHEMA.md).
// Remote read order: explicit DATA_BASE_URL wins alone; otherwise the public
// Neon Object Storage bucket (NEON_S3_ENDPOINT) then the raw GitHub fallback
// branch (force-pushed each pipeline run). The bundled public/data copy synced
// by `bun run sync:data` is always the last resort.
// Any remote miss falls back to the bundled copy and flags the bundle.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import {
  canonicalCaseId,
  caseAlias,
  flattenLandslideHit,
  FORECAST_DAY_RE,
  resolveAsset,
  TPI_CUTS,
  toMetricsView,
  toNowView,
  type MetricsView,
  type NowAlertsFile,
  type NowSummary,
} from "./contract";
import type { LayerMeta } from "./ee-layers";
import type {
  AlertsFile,
  CaseBundle,
  EventManifest,
  EventMetrics,
  EventsIndex,
  NisarPass,
  RootManifest,
  SeriesDaily,
} from "./types";

// Bundled-copy root (L14). DATA_FS_DIR overrides it; under `bun test` the
// default is the fixture copy so the suite never reads the repo's
// public/data mocks — production stays on public/data.
const dataDir = () =>
  process.env.DATA_FS_DIR ??
  (process.env.NODE_ENV === "test"
    ? path.join(process.cwd(), "test", "fixtures", "public-data")
    : path.join(process.cwd(), "public", "data"));

export interface LoadedCaseBundle extends CaseBundle {
  // True when a remote read failed and at least one file came from disk —
  // the bundle is a mix of raw fallback branch data and the bundled copy.
  // Also true when GEE creds exist but the live overlay degraded (every call
  // failed, or the layer probe answered with nothing published).
  fallback?: boolean;
  // First remote base — the client builds lazy layer URLs from
  // products[key] + this (bundled copy falls back to /data/<key>).
  assetBase?: string;
  // DEPRECATED: heavy geojson is never inlined — client lazy-loads the
  // critical_areas URL. Always undefined now.
  criticalAreas?: GeoJSON.FeatureCollection;
  // Upcoming NISAR passes for the live bundle (hoisted by toNowView).
  nisarPasses?: NisarPass[];
  // Live GEE layer metadata (L8); present when the probe answered, even
  // when the layers array is empty (GEE up, nothing published).
  liveLayers?: LayerMeta[];
  // 'gee' when at least one live call contributed content, 'static' when
  // credentialed but nothing live applied, undefined when not credentialed.
  dataSource?: "gee" | "static";
  // Contract outputs that are absent (L14): 'metrics', 'series', and the
  // product ids that were declared-but-missing. Sorted for determinism;
  // components render "pending" markers off this list — the loader never
  // fabricates values for files the real outputs haven't shipped.
  pending: string[];
  // numbers.data_date when live numbers applied. The front renders
  // "Showing last saved data from <updated_at ?? dataDate>" on fallback.
  dataDate?: string;
  // Effective TPI class cuts: manifest case-node `tpi_cuts`, else the
  // contract default (contract.TPI_CUTS). Components must use this — never
  // hard-code the cuts (A10).
  tpiCuts: readonly number[];
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

// Priority zones inline-trimmed for the <300KB payload budget: top-20 by
// properties.rank, polygon geometry replaced with the label-centroid Point
// (label_lon/label_lat properties, first ring coordinate as fallback). The
// client lazy-loads the full polygons from the layer URL.
const trimZones = (
  fc: GeoJSON.FeatureCollection | undefined,
  n = 20
): GeoJSON.FeatureCollection | undefined => {
  if (!fc?.features?.length) return fc;
  const ranked = [...fc.features]
    .sort(
      (a, b) =>
        (num(a.properties?.rank) ?? Number.MAX_SAFE_INTEGER) -
        (num(b.properties?.rank) ?? Number.MAX_SAFE_INTEGER)
    )
    .slice(0, n);
  const firstCoord = (g: GeoJSON.Geometry | null): [number, number] => {
    const c = (
      g as GeoJSON.Polygon | GeoJSON.MultiPolygon | null
    )?.coordinates?.[0]?.[0]?.[0] ?? (g as GeoJSON.Point | null)?.coordinates;
    return Array.isArray(c) && c.length >= 2
      ? [c[0] as number, c[1] as number]
      : [0, 0];
  };
  return {
    ...fc,
    features: ranked.map((f) => ({
      ...f,
      geometry: {
        type: "Point",
        coordinates:
          num(f.properties?.label_lon) !== undefined &&
          num(f.properties?.label_lat) !== undefined
            ? [f.properties!.label_lon as number, f.properties!.label_lat as number]
            : firstCoord(f.geometry),
      } as GeoJSON.Point,
    })),
  };
};

interface ReadCtx {
  bases: string[];
  fellBack: boolean;
  // Remote-attempt budget (Cache Components forbids Date.now() during
  // prerender, so the budget is counted, not timed): after this many misses
  // no new remote request starts — the bundled copy answers instead.
  remoteTries: number;
}

const GITHUB_FALLBACK_BASE =
  "https://raw.githubusercontent.com/r2l2pj/tipping-point-data/fallback/data";
// Public-read bucket URL — not a secret. Built-in default so the app works
// on a host with no data env configured at all.
const NEON_PUBLIC_BASE =
  "https://br-lively-poetry-bdub0r34.storage.c-8.us-east-2.aws.neon.tech/tipping-point-data/data";

// Max remote attempts per read context before short-circuiting to disk.
// DATA_MAX_REMOTE_TRIES overrides; ~14 files × ≤3 bases fits in 60.
const maxRemoteTries = () =>
  Number(process.env.DATA_MAX_REMOTE_TRIES) || 60;

// Remote bases in priority order (L17). An explicit DATA_BASE_URL is the sole
// remote source (override semantics — tests pin it unreachable to force the
// bundled copy). Unset, the default is the public Neon bucket (env endpoint
// if set, else the built-in public URL), then the GitHub fallback branch;
// disk is always last.
const remoteBases = (): string[] => {
  const explicit = process.env.DATA_BASE_URL;
  if (explicit) return [explicit.replace(/\/+$/, "")];
  const neon = process.env.NEON_S3_ENDPOINT
    ? `${process.env.NEON_S3_ENDPOINT.replace(/\/+$/, "")}/tipping-point-data/data`
    : NEON_PUBLIC_BASE;
  return [...new Set([neon, GITHUB_FALLBACK_BASE])];
};

const newCtx = (): ReadCtx => ({
  bases: remoteBases(),
  fellBack: false,
  remoteTries: 0,
});

// Data reads must run at request time, never inside the static prerender
// shell — a build-time capture is what left production stuck on the PPR
// fallback. `connection()` returns a pending promise during prerender (the
// hole defers to request time, so the await stalls there by design), resolves
// during a real request, and throws synchronously when no Next store exists
// (bun test / scripts) — that throw is the only case the catch swallows.
const requestTime = async () => {
  try {
    const { connection } = await import("next/server");
    await connection();
  } catch {
    // no request store — tests and scripts run data reads eagerly
  }
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

// Remote fetch inside `use cache` so raw fallback branch reads share the "minutes"
// profile; the directive is inert under `bun test`, where cacheLife has no
// cache scope to configure. Never throws — any failure is a miss so readData
// falls through to the bundled public/data copy.
async function fetchJson<T>(url: string): Promise<T | undefined> {
  "use cache";
  try {
    cacheLife("minutes");
  } catch {
    // outside a `use cache` scope (tests) there is no cache to configure
  }
  try {
    // 4s cap: prerender/build must not stall on a dead remote host.
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

async function readFs<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await readFile(
      path.join(/*turbopackIgnore: true*/ dataDir(), key),
      "utf-8"
    );
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
  // Try each remote base in order (absolute p resolves identically on every
  // base — dedupe so it isn't fetched once per base). Once the attempt
  // budget is spent no new remote request starts — straight to disk.
  const urls = ctx.bases.map((b) => resolveAsset(b, dir, p));
  if (urls[0] === undefined) return undefined;
  let missed = false;
  for (const url of new Set(urls as string[])) {
    if (ctx.remoteTries >= maxRemoteTries()) {
      ctx.fellBack = true;
      break;
    }
    ctx.remoteTries++;
    const remote = await fetchJson<T>(url).catch(() => undefined);
    if (remote !== undefined) {
      // Served by a later base after the first one missed: a substitute.
      if (missed) ctx.fellBack = true;
      return remote;
    }
    missed = true;
  }
  const key = resolveAsset("", dir, p);
  const stored =
    key === undefined || /^https?:\/\//i.test(key)
      ? undefined
      : await readFs<T>(key);
  // "Fell back" means a substitute copy served a file the first remote did
  // not. A file that is in no place at all (an optional file the case never
  // publishes, such as series/swot.json) is absent or pending, not a
  // fallback: it must not label the whole bundle "last saved data".
  if (stored !== undefined) ctx.fellBack = true;
  return stored;
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

export const getEventsIndex = async () => {
  await requestTime();
  return must(readData<EventsIndex>(newCtx(), "", "events.json"), "events.json");
};

// v4 contract: a single root manifest.json maps every case (incl. `now`) to
// { event_id, mode, bounds, layers[], metrics, products, data_dates }.
export const getRootManifest = async () => {
  await requestTime();
  return readData<RootManifest>(newCtx(), "", "manifest.json");
};

export const getManifest = async (id: string) => {
  await requestTime();
  return must(
    firstOf<EventManifest>(newCtx(), dirsFor(id), "manifest.json"),
    `${id}/manifest.json`
  );
};

export const getMetrics = async (id: string) => {
  await requestTime();
  const ctx = newCtx();
  const dirs = dirsFor(id);
  const root = await readData<RootManifest>(ctx, "", "manifest.json");
  const entry = root?.cases?.[dirs[0]] ?? root?.cases?.[id];
  // L14: absent metrics return undefined (pending), they do not throw.
  return loadMetrics(ctx, entry?.metrics ?? `metrics.json#${dirs[0]}`, dirs);
};

export const getSeries = async (id: string) => {
  await requestTime();
  return firstOf<SeriesDaily>(newCtx(), dirsFor(id), "series/imerg_smap_daily.json");
};

// L14: absent alerts.json -> undefined; the /alerts page renders pending.
export const getAlerts = async () => {
  await requestTime();
  return readData<AlertsFile>(newCtx(), "", "alerts.json");
};

// One case = one entry in the root manifest's `cases` map (canonical
// underscore keys; caseAlias maps the hyphen event ids used by events.json),
// backed by a directory under public/data/<case-key>. Legacy per-case
// manifest.json files still resolve when the root manifest doesn't list the
// case — hyphen-named legacy dirs are tried after the canonical one.
export async function getCaseBundle(
  id: string,
  title: string,
  bbox?: [number, number, number, number],
  reference_date?: string,
  opts?: CaseBundleOpts
): Promise<LoadedCaseBundle> {
  await requestTime();
  const ctx = newCtx();
  const dirs = dirsFor(id);
  const canonical = dirs[0];

  const root = await readData<RootManifest>(ctx, "", "manifest.json");
  // L14: the root manifest is the one file a bundle cannot be built
  // without — everything else absent degrades to `pending`, never throws.
  if (root === undefined) throw new Error("data: manifest.json not found");
  const entry = root?.cases?.[canonical] ?? root?.cases?.[id];
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
        tpi_cuts: entry?.tpi_cuts ?? perCase?.tpi_cuts,
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
          tpi_cuts: entry.tpi_cuts ?? perCase?.tpi_cuts,
        }
      : perCase;

  // In remote mode layer png/cog paths resolve to the first remote base (the
  // browser cannot fall back across bases); on disk they
  // stay data-root-relative (/data/... via resolveDataUrl).
  if (ctx.bases.length > 0 && manifest?.layers) {
    const assetBase = ctx.bases[0];
    manifest.layers = manifest.layers.map((l) => ({
      ...l,
      png: resolveAsset(assetBase, canonical, l.png) ?? l.png,
      cog: resolveAsset(assetBase, canonical, l.cog) ?? l.cog,
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
  // data_dates.observed, else the reference date. The live calls are kicked
  // once referenceDate is derived below (it can come from the series file).
  const d0Date = now?.layers.find(
    (l) => /_d0$/.test(l.id) && typeof l.date === "string"
  )?.date;
  const observedDate =
    now?.data_dates && typeof now.data_dates.observed === "string"
      ? now.data_dates.observed
      : undefined;

  const [
    metrics,
    series,
    swot,
    zonesRaw,
    places,
    summary,
    nowAlerts,
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
    geo("places", "geojson/places.geojson"),
    now
      ? loadProduct<NowSummary>(ctx, canonical, rawProducts, "summary", "summary.json")
      : undefined,
    now
      ? loadProduct<NowAlertsFile>(ctx, canonical, rawProducts, "alerts", "alerts.json")
      : undefined,
  ]);

  // A10: bbox and reference_date come from the contract, not caller literals.
  // bbox = manifest `bounds` ?? caller arg ?? events.json entry `bbox`;
  // `bounds` is a required contract field, so a case with no bounds anywhere
  // is a contract violation and throws (same spirit as `must` on required
  // files). reference_date chain: explicit arg ?? manifest.updated_at (first
  // 10 chars) ?? data_dates.observed ?? latest non-forecast layer.date ??
  // series.reference_date ?? events.json entry.
  const latestObservedLayerDate = (manifest?.layers ?? [])
    .filter(
      (l) =>
        typeof l.date === "string" &&
        !(l.forecast === true ||
          (l.forecast === undefined && FORECAST_DAY_RE.test(l.id)))
    )
    .map((l) => l.date as string)
    .sort()
    .pop();
  const dataDateObserved =
    typeof manifest?.data_dates?.observed === "string"
      ? manifest.data_dates.observed.slice(0, 10)
      : undefined;
  let resolvedBbox = manifest?.bounds ?? bbox;
  let referenceDate =
    reference_date ??
    manifest?.updated_at?.slice(0, 10) ??
    dataDateObserved ??
    latestObservedLayerDate ??
    series?.reference_date;
  if (resolvedBbox === undefined || referenceDate === undefined) {
    const index = await readData<EventsIndex>(ctx, "", "events.json");
    const eventId = manifest?.event_id ?? manifest?.event;
    const event = index?.events.find(
      (e) => e.id === eventId || e.id === id
    );
    resolvedBbox ??= event?.bbox;
    referenceDate ??= event?.reference_date;
  }
  if (resolvedBbox === undefined)
    throw new Error(`data: bounds for ${id} not found`);

  // L14: absent contract outputs surface as pending markers. `metrics` and
  // `series` are named entries; products declared in the map (non-null path)
  // but missing from storage list their product id. Keys declared `null`
  // mean "absent by contract" — not pending. L14: no fabricated timeline —
  // an absent series file stays undefined for every case, `now` included.
  const effectiveSeries = series;
  // Priority zones ship inline but trimmed: top-20 by properties.rank,
  // polygon geometry swapped for the label-centroid Point (the client
  // lazy-loads the full polygons via products[] + assetBase). Every other
  // heavy geojson (permanent_water, flood_confirmed, landslide_candidates,
  // landslide_catalog, municipal_boundaries, critical_areas) is NOT loaded
  // server-side — the client fetches its URL lazily, and it is not pending:
  // pending stays for products-map null / a file that is truly missing.
  const zones = trimZones(zonesRaw);
  const pending = new Set<string>();
  if (metrics === undefined) pending.add("metrics");
  if (effectiveSeries === undefined) pending.add("series");
  const declaredMissing: Record<string, unknown> = {
    imerg_smap_daily: series,
    swot,
    priority_zones: zones,
    places,
    ...(now ? { summary, alerts: nowAlerts } : {}),
  };
  for (const [key, value] of Object.entries(declaredMissing)) {
    if (typeof rawProducts?.[key] === "string" && value === undefined)
      pending.add(key);
  }

  const numbersDate =
    canonical === "now"
      ? (d0Date ?? observedDate ?? referenceDate)
      : referenceDate;

  // Skip the overlay where it can never add content: an empty `now` node
  // (no layers, no products, no data_dates) has no live assets to overlay.
  const liveEligible =
    canonical !== "now" ||
    Boolean(
      now?.layers.length ||
        Object.keys(now?.products ?? {}).length ||
        (now?.data_dates && Object.values(now.data_dates).some(Boolean))
    );

  // One slow/failed call must not hang the other — the helpers carry their
  // own internal timeouts, and the whole overlay is capped at
  // GEE_OVERLAY_TIMEOUT_MS (default 1.2 s) so a hung GEE roundtrip can never
  // stall the page stream.
  const livePending =
    gee && liveEligible
      ? Promise.allSettled([
          numbersDate !== undefined
            ? gee.numbers?.({ caseId: canonical, date: numbersDate })
            : undefined,
          gee.layers?.(canonical),
        ])
      : undefined;

  const bundle: LoadedCaseBundle = {
    id,
    title,
    mode: manifest?.mode ?? (now ? "live" : "replay"),
    bbox: resolvedBbox,
    reference_date: referenceDate,
    updated_at: manifest?.updated_at,
    data_dates: manifest?.data_dates,
    manifest,
    metrics,
    // Nested landslide_hit -> flat event-day landslide_hit_pct (the day
    // matching referenceDate, else the last per_day entry).
    metricsView: flattenLandslideHit(toMetricsView(metrics), referenceDate),
    summary,
    nowAlerts,
    nisarPasses: now?.nisar_passes,
    swot,
    products: manifest?.products,
    series: effectiveSeries,
    pending: [...pending].sort(),
    tpiCuts: manifest?.tpi_cuts ?? TPI_CUTS,
    zones,
    places,
    assetBase: ctx.bases[0],
    fallback: ctx.fellBack,
  };

  // Apply whatever the live GEE calls returned (L8). Numbers overlay the
  // metricsView/summary fields; layer meta lands on liveLayers. An answered
  // but EMPTY layers array means GEE is up yet nothing is published —
  // degraded, not content.
  const overlayTimeoutMs =
    Number(process.env.GEE_OVERLAY_TIMEOUT_MS) || 1200;
  const [numbersSettled, layersSettled] = livePending
    ? await Promise.race([
        livePending,
        new Promise<[]>(
          (resolve) => setTimeout(() => resolve([]), overlayTimeoutMs)
        ),
      ])
    : [];
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
