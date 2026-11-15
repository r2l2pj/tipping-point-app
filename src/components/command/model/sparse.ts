// Conductor (v6, Uruguaiana replay): a past event whose products will not
// come shows only what it has — no "pending" / "not published yet" blocks.
// Scoped to the featured replay (the other replays keep their full layout).
import { isFeatured } from "../state";
import type { CcBundle } from "./types";

export const isMissingText = (v: unknown): boolean =>
  typeof v !== "string" || /^(pending|not published yet|images not published yet|not computed)$/i.test(v.trim());
export const hideMissingFor = (bundle: CcBundle): boolean => bundle.mode === "replay" && isFeatured(bundle);
