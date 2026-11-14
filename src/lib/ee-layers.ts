// Layer metadata probe for live GEE assets (L8). Per-case derived rasters are
// multiband series at <assetRoot>/<canonical_case>/<layer>_series with bands
// named YYYYMMDD; single-day statics/masks live at the bare <layer> id.
// Manifest-declared assets (root manifest cases[].layers[].asset, e.g.
// now/<layer>_d<k> forecast days) merge in as declared:true entries.
// ee is typed structurally here — do not import from ee-tiles (sibling unit).
import { credentialEnv, earthEngine } from "./ee";
import { canonicalCaseId } from "./contract";
import { getRootManifest } from "./data";
import type { RootManifest } from "./types";

export interface EeImageLike {
  getInfo(cb: (data: unknown, err?: string) => void): void;
}

export interface EeLike {
  Image(id: string): EeImageLike;
}

export class LayersCredsError extends Error {
  constructor(message = "no service-account key (set GCP_SA_KEY)") {
    super(message);
    this.name = "LayersCredsError";
  }
}

export interface LayerMeta {
  id: string;
  dates: string[];
  data_date?: string;
  updated_at?: string;
  asset?: string;
  declared?: boolean;
}

export interface LayerMetaResult {
  case: string;
  layers: LayerMeta[];
}

// reconcile with LAYER_VIS registry after merge
const PROBE_LAYERS = [
  "tpi_slide",
  "tpi_flood",
  "t_ml",
  "nisar_pre",
  "nisar_post",
  "night_lights_pre",
  "night_lights_post",
  "opera_validation",
  "hillshade",
  "flood_confirmed",
  "permanent_water",
  "landslide_candidates",
  "imerg",
  "smap",
] as const;

const PROBE_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 15 * 60 * 1000;

// reconcile with ee-tiles resolveAsset after merge
function assetRoot(): string {
  return (
    process.env.GEE_ASSET_ROOT ??
    `projects/${process.env.GEE_PROJECT}/assets/tipping-point`
  );
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`getInfo timed out after ${ms}ms`)),
      ms
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

interface EeImageInfo {
  bands?: { id?: unknown }[];
  properties?: Record<string, unknown>;
}

// Series bands are named YYYYMMDD; normalize to the contract's YYYY-MM-DD.
// Band ids already in YYYY-MM-DD form (or anything else) pass through.
const normalizeBandDate = (id: string): string =>
  /^\d{8}$/.test(id)
    ? `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`
    : id;

function getInfo(ee: EeLike, assetId: string): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    ee.Image(assetId).getInfo((data, err) =>
      err ? reject(new Error(err)) : resolve(data)
    );
  });
}

function toLayerMeta(id: string, info: unknown, asset?: string): LayerMeta {
  const { bands, properties: props = {} } = (info ?? {}) as EeImageInfo;
  const dates = (Array.isArray(bands) ? bands : [])
    .map((b) => b?.id)
    .filter((d): d is string => typeof d === "string")
    .map(normalizeBandDate)
    .sort();
  return {
    id,
    dates,
    ...(typeof props.data_date === "string" ||
    typeof props.updated_at === "string"
      ? { data_date: (props.data_date ?? props.updated_at) as string }
      : {}),
    ...(typeof props.updated_at === "string"
      ? { updated_at: props.updated_at }
      : {}),
    ...(asset ? { asset } : {}),
  };
}

// Probe <id>_series first (per-case derived rasters), then the bare <id>
// (single-day statics/masks). Throws when neither asset resolves.
async function probeLayer(
  ee: EeLike,
  root: string,
  canonical: string,
  id: string,
  timeoutMs: number
): Promise<LayerMeta> {
  try {
    const info = await withTimeout(
      getInfo(ee, `${root}/${canonical}/${id}_series`),
      timeoutMs
    );
    return toLayerMeta(id, info);
  } catch {
    const info = await withTimeout(
      getInfo(ee, `${root}/${canonical}/${id}`),
      timeoutMs
    );
    return toLayerMeta(id, info);
  }
}

// Manifest-declared asset ids: "projects/..." used as-is, paths containing
// "/" resolve under the asset root, bare names under the case dir.
function declaredAssetId(root: string, canonical: string, asset: string) {
  if (asset.startsWith("projects/")) return asset;
  return asset.includes("/")
    ? `${root}/${asset}`
    : `${root}/${canonical}/${asset}`;
}

interface DeclaredLayer {
  id: string;
  date?: string;
  asset: string;
}

function manifestDeclared(
  manifest: RootManifest | undefined,
  canonical: string
): DeclaredLayer[] {
  return (manifest?.cases?.[canonical]?.layers ?? [])
    .map((l) => l as { id?: unknown; date?: unknown; asset?: unknown })
    .filter(
      (l): l is DeclaredLayer =>
        typeof l.id === "string" && typeof l.asset === "string"
    )
    .map((l) => ({
      id: l.id,
      date: typeof l.date === "string" ? l.date : undefined,
      asset: l.asset,
    }));
}

// Merge manifest-declared layers into probed results: probe each declared
// asset once; on failure report the manifest's declared date. Declared ids
// already probed keep their dates and pick up asset/declared flags.
async function mergeDeclared(
  ee: EeLike,
  root: string,
  canonical: string,
  declared: DeclaredLayer[],
  layers: LayerMeta[],
  timeoutMs: number
): Promise<void> {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const settled = await Promise.allSettled(
    declared.map(async (d) => {
      const assetId = declaredAssetId(root, canonical, d.asset);
      const info = await withTimeout(getInfo(ee, assetId), timeoutMs);
      return { d, assetId, info };
    })
  );
  for (const [i, r] of settled.entries()) {
    const d = declared[i];
    const meta =
      r.status === "fulfilled"
        ? { ...toLayerMeta(d.id, r.value.info, r.value.assetId), declared: true }
        : {
            id: d.id,
            dates: d.date ? [normalizeBandDate(d.date)] : [],
            asset: declaredAssetId(root, canonical, d.asset),
            declared: true as const,
          };
    const existing = byId.get(d.id);
    if (existing) {
      existing.asset = meta.asset;
      existing.declared = true;
      if (!existing.dates.length) existing.dates = meta.dates;
      existing.data_date ??= meta.data_date;
      existing.updated_at ??= meta.updated_at;
    } else {
      byId.set(d.id, meta);
      layers.push(meta);
    }
  }
}

export interface LayerServiceOpts {
  assetRoot?: string;
  timeoutMs?: number;
  // Skip/override the root manifest read (tests inject a manifest or null).
  manifest?: RootManifest | null;
}

// Test seam: inject a structural ee so no credentials are needed.
export function createLayerService(ee: EeLike, opts: LayerServiceOpts = {}) {
  const root = opts.assetRoot ?? assetRoot();
  const timeoutMs = opts.timeoutMs ?? PROBE_TIMEOUT_MS;
  return {
    async probe(
      canonical: string,
      ids: readonly string[] = PROBE_LAYERS
    ): Promise<LayerMeta[]> {
      const [settled, manifest] = await Promise.all([
        Promise.allSettled(
          ids.map((id) => probeLayer(ee, root, canonical, id, timeoutMs))
        ),
        opts.manifest !== undefined
          ? Promise.resolve(opts.manifest)
          : getRootManifest(),
      ]);
      const layers = settled.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : []
      );
      if (manifest) {
        await mergeDeclared(
          ee,
          root,
          canonical,
          manifestDeclared(manifest, canonical),
          layers,
          timeoutMs
        );
      }
      return layers;
    },
  };
}

const cache = new Map<string, { at: number; result: LayerMetaResult }>();

export interface GetLayerMetaOpts {
  layer?: string; // probe a single layer id (bypasses cache + manifest merge)
  ee?: EeLike; // test seam: skips the credential check and earthEngine()
  manifest?: RootManifest | null; // test seam: overrides the manifest read
}

export async function getLayerMeta(
  caseId: string,
  opts: GetLayerMetaOpts = {}
): Promise<LayerMetaResult> {
  const canonical = canonicalCaseId(caseId);

  let ee = opts.ee;
  if (!ee) {
    if (!credentialEnv()) throw new LayersCredsError();
    ee = (await earthEngine()) as unknown as EeLike;
  }

  if (!opts.layer) {
    const hit = cache.get(canonical);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;
  }

  const service = createLayerService(ee, {
    manifest: opts.layer ? null : opts.manifest,
  });
  const layers = await service.probe(
    canonical,
    opts.layer ? [opts.layer] : undefined
  );
  const result: LayerMetaResult = { case: canonical, layers };
  if (!opts.layer) cache.set(canonical, { at: Date.now(), result });
  return result;
}
