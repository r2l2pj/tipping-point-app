// Shared types of the Command Center model. The loader fields below exist on
// LoadedCaseBundle (src/lib/data.ts); they are repeated here as optional so
// the model never imports the server-only loader module.
import type { CaseBundle, NisarPass } from "@/lib/types";

export type CcBundle = CaseBundle & {
  fallback?: boolean;
  // First remote data base; lazy GeoJSON URLs are built from it.
  assetBase?: string;
  dataDate?: string;
  tpiCuts?: readonly number[];
  nisarPasses?: NisarPass[];
  // Number of passes before the list was cut to the cards shown (A10).
  nisarPassCount?: number;
  // Live case: the run is not marked verified (now node `verified: true`),
  // so its risk outputs (TPI, probability, summary numbers) are not shown.
  // Radar observations stay. Set by CommandCenterLoader.
  riskPaused?: boolean;
  // Shared prefix of the manifest layers' png/cog URLs while in transit
  // (model/layerUrls.ts); restored by the screen before use.
  layerUrlBase?: string;
  // Live: the observed cards, computed on the server from alerts.json
  // observed[] (see observedRows); the raw list is not sent to the browser.
  observedSummary?: import("./alerts").ObservedRow[];
  // Replay: the TEST card and importance groups built on the server from
  // lead-ml's global exports (model/ml.ts).
  ml?: import("./ml").MlView;
  mlImportance?: import("./ml").ImportanceView;
  // Replay: data/<case>/forecast_lead_time.json (NOAA GFS forecast replay).
  forecastLeadTime?: unknown;
  // `_null_reasons` of the case node in the root manifest. The loader in
  // src/lib does not carry it, so CommandCenterLoader attaches it.
  nullReasons?: Record<string, string>;
  // Set by the screen while a GeoJSON product is being fetched in the
  // browser, or when the fetch found no file (see model/lazy.ts).
  lazy?: Partial<Record<"priority_zones" | "landslide_candidates", "loading" | "missing">>;
  // True while `zones` is the trimmed inline copy (top 20 by rank).
  zonesTrimmed?: boolean;
};

export type Hazard = "slide" | "flood";

export const HAZARD_LABEL: Record<Hazard, string> = {
  slide: "Landslide",
  flood: "Flood",
};

export const NOT_PUBLISHED = "not published yet";
export const RISK_PAUSED_TEXT = "Risk map paused while we verify today's data";
export const RISK_PAUSED_SHORT = "paused while we verify today's data";
