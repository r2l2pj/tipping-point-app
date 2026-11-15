// L52 U1 (Lucas: "a user doesn't have to think"): the Layers column opens on
// a few big, mutually exclusive map views; the single toggles move under
// "More layers (advanced)". A view is a layer set (deep links keep using
// ?layers=, and the view whose layers are on shows as selected).
import { keepAvailable, layerAvailable, type LayerId } from "./layerRegistry";
import type { CcBundle, Hazard } from "./types";

export type ViewId = "risk" | "rain" | "radar" | "satellite";
export interface MapView { id: ViewId; label: string; line: string }

export const VIEWS: MapView[] = [
  { id: "risk", label: "Risk now & next days", line: "Forecast risk map" },
  { id: "rain", label: "Rain", line: "Observed rain (NASA GPM)" },
  { id: "radar", label: "Radar — NISAR", line: "Flooded areas seen by radar" },
  { id: "satellite", label: "Satellite", line: "True-colour imagery" },
];

// Layers of a view in this case; [] = the view has nothing to show here.
export function viewLayers(bundle: CcBundle, hazard: Hazard, id: ViewId): LayerId[] {
  const ok = (ids: LayerId[]) => keepAvailable(bundle, ids, hazard);
  switch (id) {
    case "risk":
      // Now + landslide: the ML likelihood is the primary forecast view (L48).
      if (bundle.mode === "live" && hazard === "slide" && layerAvailable(bundle, "ptrigger", hazard)) return ["ptrigger"];
      return ok(["tpi"]);
    case "rain":
      return ok(["imerg"]);
    case "radar":
      return ok(["flood"]);
    case "satellite":
      return [];
  }
}

export function activeView(layers: readonly LayerId[]): ViewId | undefined {
  // Now opens with the risk map plus the radar candidates: that is "Risk".
  if (layers.includes("imerg")) return "rain";
  if (layers.includes("tpi") || layers.includes("ptrigger")) return "risk";
  if (layers.includes("flood")) return "radar";
  return undefined;
}
