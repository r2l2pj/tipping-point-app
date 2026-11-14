import { Suspense } from "react";
import Link from "next/link";
import { getAlerts } from "@/lib/data";
import type { Alert } from "@/lib/types";
import { fmtDate } from "@/lib/tpi";

// Public alert feed — the same message format the Telegram bot sends
// (project doc v3, "Mensagem de alerta").
async function AlertsList() {
  const file = await getAlerts().catch(() => null);
  if (!file || file.alerts.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No active alerts — the monitor is running and the region is below the
        alert threshold.
      </p>
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {file.alerts.map((a) => (
        <AlertCard key={a.id} alert={a} />
      ))}
    </ul>
  );
}

const LEVEL_STYLE: Record<string, { badge: string; border: string; word: string }> = {
  emergency: { badge: "bg-red-700 text-white", border: "border-red-800", word: "CRITICAL" },
  warning: { badge: "bg-orange-600 text-white", border: "border-orange-800", word: "HIGH" },
  watch: { badge: "bg-amber-500 text-black", border: "border-amber-700", word: "ELEVATED" },
};

function AlertCard({ alert: a }: { alert: Alert }) {
  const style = LEVEL_STYLE[a.level] ?? LEVEL_STYLE.watch;
  const hazardWord = a.hazard === "flood" ? "flood" : "landslide";
  const imerg = a.data_dates?.imerg;
  const smap = a.data_dates?.smap;

  return (
    <li className={`rounded-lg border ${style.border} bg-zinc-900/60 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-100">
          ⚠ Tipping Point: {style.word} {hazardWord} risk
        </p>
        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}>
          {a.level}
        </span>
      </div>

      <p className="mt-2 text-xs text-zinc-300">
        <span className="text-zinc-500">Region:</span> {a.region ?? a.area}
      </p>
      {a.rain && <p className="mt-1 text-xs text-zinc-300">{a.rain} {a.soil}</p>}
      {a.forecast && <p className="mt-1 text-xs text-zinc-300">Forecast: {a.forecast}</p>}
      {(imerg || smap) && (
        <p className="mt-1 text-[11px] text-zinc-500">
          NASA data: {imerg ? `IMERG through ${fmtDate(imerg)}` : ""}
          {imerg && smap ? " · " : ""}
          {smap ? `SMAP ${fmtDate(smap)}` : ""}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
        <span>
          Valid {fmtDate(a.valid_from)} → {fmtDate(a.valid_to)}
        </span>
        <span className="rounded border border-zinc-700 px-1.5 py-0.5">
          certainty: {a.certainty}
        </span>
        <span className="rounded border border-zinc-700 px-1.5 py-0.5">
          hazard: {a.hazard}
        </span>
      </div>

      <p className="mt-3 text-xs text-zinc-300">{a.guidance}</p>
      <p className="mt-2 text-[11px] font-medium text-zinc-400">
        Follow Civil Defense guidance. SMS 40199.
      </p>
      {a.map && (
        <Link href={a.map} className="mt-2 inline-block text-[11px] text-cyan-400 hover:underline">
          View on the map →
        </Link>
      )}
    </li>
  );
}

export default function AlertsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0b0e14] text-zinc-100">
      <header className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold tracking-wider">TIPPING POINT</h1>
          <span className="text-xs text-zinc-400">| Public alerts</span>
        </div>
        <Link href="/" className="text-xs text-cyan-400 hover:underline">
          ← Ops dashboard
        </Link>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <p className="mb-4 text-xs text-zinc-500">
          Alerts are issued when the Tipping Point Index rises to High or
          Critical — max one alert every 6 h, none between 23:00 and 06:00
          unless the class is Critical.
        </p>
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading alerts…</p>}>
          <AlertsList />
        </Suspense>
      </main>
      <footer className="border-t border-zinc-800 px-4 py-3 text-[10px] text-zinc-600">
        Data: NASA GPM · SMAP · NASADEM · NISAR · Illustrative demo data.
      </footer>
    </div>
  );
}
