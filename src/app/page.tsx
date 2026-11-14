import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";
import { getCaseBundle, getEventsIndex } from "@/lib/data";
import type { CaseBundle } from "@/lib/types";

// Loads every case's bundle server-side (small mock JSONs from public/data),
// then hands the whole set to the client dashboard. `now/` is the live mode.
async function DashboardLoader() {
  const index = await getEventsIndex().catch(() => null);
  const cases: CaseBundle[] = [];

  if (index) {
    for (const e of index.events) {
      cases.push(await getCaseBundle(e.id, e.title, e.bbox, e.reference_date));
    }
  }
  // Live mode ("Agora") — southern Brazil, refreshed by the 3-hourly pipeline.
  const now = await getCaseBundle("now", "Now — Southern Brazil", [-58, -34, -48, -22.5], "2026-11-14");
  if (now.manifest) cases.push(now);

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
