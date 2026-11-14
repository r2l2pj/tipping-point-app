// Bundle builders shared by the Command Center tests. Not sample data for
// the screen: nothing here is imported by app code.
import type { DayPoint } from "@/lib/types";
import type { CcBundle } from "./types";

export const bundle = (over: Partial<CcBundle> = {}): CcBundle => ({
  id: "wa_2025",
  title: "WA 2025",
  mode: "replay",
  bbox: [-122.6, 47.0, -121.5, 48.5],
  reference_date: "2025-12-10",
  ...over,
});

export const liveBundle = (over: Partial<CcBundle> = {}): CcBundle =>
  bundle({ id: "now", title: "Now — Southern Brazil", mode: "live", bbox: [-58, -34, -48, -22.5], reference_date: undefined, ...over });

export const days = (
  tpis: number[],
  kinds: DayPoint["kind"][] = [],
  eventIndex = 0
): DayPoint[] =>
  tpis.map((tpi, i) => ({
    date: `2025-12-${String(10 + i).padStart(2, "0")}`,
    offset: i - eventIndex,
    kind: kinds[i] ?? "observed",
    tpi,
    imerg_mm: 10,
    smap: 0.9,
  }));

export const series = (
  tpis: number[],
  kinds: DayPoint["kind"][] = [],
  tpi_threshold: number | undefined = 0.6,
  eventIndex = 0
): CcBundle["series"] => ({
  event: "wa_2025",
  reference_date: "2025-12-10",
  tpi_threshold,
  days: days(tpis, kinds, eventIndex),
});

export const zone = (
  rank: number,
  props: Record<string, unknown> = {}
): GeoJSON.Feature => ({
  type: "Feature",
  properties: {
    rank, name: "Darrington", tpi: 0.9, class: "Critical", hazard: "landslide",
    area_km2: 10, people: null, ...props,
  },
  geometry: {
    type: "Polygon",
    coordinates: [[[-122, 48], [-121.8, 48], [-121.8, 48.2], [-122, 48.2], [-122, 48]]],
  },
});

export const zones = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features,
});

export const point = (props: Record<string, unknown> = {}): GeoJSON.Feature => ({
  type: "Feature",
  properties: props,
  geometry: { type: "Point", coordinates: [-121.9, 47.8] },
});

const frame = (id: string, date: string, forecast?: boolean) => ({
  id, date, png: `wa_2025/png/${id}_${date}.png`, cog: `wa_2025/cog/${id}.tif`,
  bounds: [-122.6, 47, -121.5, 48.5] as [number, number, number, number],
  ...(forecast === undefined ? {} : { forecast }),
});

export const manifest = (
  layers: ReturnType<typeof frame>[] | Record<string, unknown>[],
  over: Record<string, unknown> = {}
): CcBundle["manifest"] => ({ event: "wa_2025", layers: layers as never, ...over });

export { frame };
