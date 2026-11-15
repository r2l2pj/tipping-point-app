"use client";

import { useEffect, useState } from "react";
import { fetchGeo } from "@/lib/layers";

// One GeoJSON product fetched in the browser through the cache the map hook
// uses too (one transfer per file). Returns undefined while loading, null
// when there is no URL or the fetch found no file.
export function useGeo(url: string | undefined): GeoJSON.FeatureCollection | null | undefined {
  const [hit, setHit] = useState<{ url: string; fc: GeoJSON.FeatureCollection | null }>();
  useEffect(() => {
    if (!url) return;
    let live = true;
    void fetchGeo(url).then((fc) => {
      if (live) setHit({ url, fc });
    });
    return () => {
      live = false;
    };
  }, [url]);
  if (!url) return null;
  return hit?.url === url ? hit.fc : undefined;
}
