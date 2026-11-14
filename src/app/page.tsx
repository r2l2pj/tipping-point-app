import { Suspense } from "react";
import Map from "@/components/Map";
import { getEventsIndex } from "@/lib/data";

async function EventsPanel() {
  const index = await getEventsIndex().catch(() => null);

  if (!index) {
    return (
      <p className="text-sm text-zinc-500">
        No data yet — run <code>bun run sync:data</code>
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {index.events.map((e) => (
        <li
          key={e.id}
          className="rounded border border-zinc-800 p-3 hover:border-zinc-600"
        >
          <p className="text-sm font-medium">{e.title}</p>
          <p className="text-xs text-zinc-500">
            {e.id} · ref {e.reference_date}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-black text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-bold tracking-wide">TIPPING POINT</h1>
          <p className="text-xs text-zinc-400">Rain warns. Radar confirms.</p>
        </div>
        <span className="text-xs text-zinc-500">
          NASA Space Apps 2026 · Dancing with the SARs
        </span>
      </header>

      <main className="flex flex-1">
        <div className="relative flex-1">
          <Map />
        </div>
        <aside className="w-80 border-l border-zinc-800 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Events
          </h2>
          <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
            <EventsPanel />
          </Suspense>
        </aside>
      </main>
    </div>
  );
}
