import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";
import { getCaseBundle, getEventsIndex } from "@/lib/data";
import type { CaseBundle } from "@/lib/types";

// Loads every case's bundle server-side (small mock JSONs from public/data),
// then hands the whole set to the client dashboard. `now/` is the live mode.
async function DashboardLoader() {
  const index = await getEventsIndex().catch(() => null);
  const cases: CaseBundle[] = [];

  // All bundles load in parallel — a slow case (or its GEE overlay timeout)
  // must not serialize the whole page stream. A failing case is skipped.
  // Live mode ("Agora") — southern Brazil, refreshed by the 3-hourly pipeline.
  const [eventBundles, now] = await Promise.all([
    Promise.all(
      (index?.events ?? []).map((e) =>
        getCaseBundle(e.id, e.title, e.bbox, e.reference_date).catch(() => null)
      )
    ),
    getCaseBundle("now", "Now — Southern Brazil", [-58, -34, -48, -22.5], "2026-11-14").catch(() => null),
  ]);
  for (const b of eventBundles) if (b) cases.push(b);
  if (now?.manifest) {
    now.bbox = now.manifest.bounds ?? now.bbox;
    now.reference_date = now.manifest.updated_at?.slice(0, 10) ?? now.reference_date;
    cases.push(now);
  }

  return <Dashboard cases={cases} />;
}

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-[#0b0e14] text-zinc-100">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Loading dashboard…
          </div>
        }
      >
        <DashboardLoader />
      </Suspense>
    </div>
  );
}
