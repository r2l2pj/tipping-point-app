// R3 priority zones (lead-analysis, Now case) are IBGE municipalities with
// `sources`: "tpi-critical" (the risk index) and/or satellite flood sources
// ("opera-dswx-s1", "nisar-gcov"). A municipality seen only by satellite is
// an observation, not a risk class; one flagged only by the TPI is a model
// output (held back while the live run is unverified). Replay zones carry
// no `sources`: neither helper applies to them.

// `sources` as a list; MapLibre's geojson tiling stringifies arrays, so a
// JSON string is accepted too.
export function zoneSources(props: Record<string, unknown> | null | undefined): string[] | undefined {
  const raw = props?.sources;
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
  if (typeof raw === "string" && raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const isTpi = (s: string) => /tpi/i.test(s);

export const observedOnlyZone = (props: Record<string, unknown> | null | undefined): boolean => {
  const s = zoneSources(props);
  return !!s && s.length > 0 && !s.some(isTpi);
};

export const tpiOnlyZone = (props: Record<string, unknown> | null | undefined): boolean => {
  const s = zoneSources(props);
  return !!s && s.length > 0 && s.every(isTpi);
};

export const OBSERVED_CLASS = "Observed flood";
