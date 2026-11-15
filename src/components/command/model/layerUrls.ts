// Page budget (A10): every manifest layer carries absolute png/cog URLs that
// share one prefix (the data base + case dir). The server strips that prefix
// once per bundle (layerUrlBase) and the screen restores it before anything
// reads a layer, so components never see a relative path.
import type { CcBundle } from "./types";

type Layer = NonNullable<CcBundle["manifest"]>["layers"][number];

const commonPrefix = (urls: string[]): string => {
  if (!urls.length) return "";
  let p = urls[0];
  for (const u of urls) while (!u.startsWith(p)) p = p.slice(0, -1);
  return p.slice(0, p.lastIndexOf("/") + 1); // whole path segments only
};

export function compactLayerUrls(bundle: CcBundle): CcBundle {
  const layers = bundle.manifest?.layers;
  if (!layers?.length) return bundle;
  const urls = layers.flatMap((l) => [l.png, l.cog]).filter((u): u is string => typeof u === "string");
  if (!urls.length || !urls.every((u) => /^https?:\/\//.test(u))) return bundle;
  const base = commonPrefix(urls);
  if (base.length < 12) return bundle;
  const cut = (u: string | null | undefined) => (typeof u === "string" ? u.slice(base.length) : u);
  return {
    ...bundle,
    layerUrlBase: base,
    manifest: { ...bundle.manifest!, layers: layers.map((l): Layer => ({ ...l, png: cut(l.png) as Layer["png"], cog: cut(l.cog) as Layer["cog"] })) },
  };
}

export function expandLayerUrls(bundle: CcBundle): CcBundle {
  const base = bundle.layerUrlBase;
  if (!base || !bundle.manifest?.layers) return bundle;
  const put = (u: string | null | undefined) => (typeof u === "string" && u ? base + u : u);
  return {
    ...bundle,
    layerUrlBase: undefined,
    manifest: { ...bundle.manifest, layers: bundle.manifest.layers.map((l): Layer => ({ ...l, png: put(l.png) as Layer["png"], cog: put(l.cog) as Layer["cog"] })) },
  };
}
