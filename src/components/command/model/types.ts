// Shared types of the Command Center model. The loader fields below exist on
// LoadedCaseBundle (src/lib/data.ts); they are repeated here as optional so
// the model never imports the server-only loader module.
import type { CaseBundle, NisarPass } from "@/lib/types";

export type CcBundle = CaseBundle & {
  fallback?: boolean;
  dataDate?: string;
  tpiCuts?: readonly number[];
  nisarPasses?: NisarPass[];
  // `_null_reasons` of the case node in the root manifest. The loader in
  // src/lib does not carry it, so CommandCenterLoader attaches it.
  nullReasons?: Record<string, string>;
};

export type Hazard = "slide" | "flood";

export const HAZARD_LABEL: Record<Hazard, string> = {
  slide: "Landslide",
  flood: "Flood",
};

export const NOT_PUBLISHED = "not published yet";
