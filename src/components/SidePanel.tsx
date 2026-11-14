"use client";

import type { CaseBundle, NisarPass, PriorityZone } from "@/lib/types";
import { fmtDate, fmtKm2, fmtPct, fmtPeople } from "@/lib/tpi";
import TpiChart from "./TpiChart";

export type TabKey = "alert" | "radar" | "validation" | "impact";

const TABS: { key: TabKey; label: string }[] = [
  { key: "alert", label: "ALERT" },
  { key: "radar", label: "RADAR" },
  { key: "validation", label: "VALIDATION" },
  { key: "impact", label: "IMPACT" },
];

export default function SidePanel({
  tab,
  onTab,
  bundle,
  zones,
  dayIndex,
  onConfirmRadar,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  bundle: CaseBundle;
  zones: PriorityZone[];
  dayIndex: number;
  onConfirmRadar: () => void;
}) {
  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-zinc-800 bg-[#0d1117]">
      <nav className="flex border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            className={`flex-1 px-2 py-2.5 text-[11px] font-semibold tracking-wider ${
              tab === t.key
                ? "border-b-2 border-cyan-500 text-cyan-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "alert" && (
          <AlertTab bundle={bundle} zones={zones} dayIndex={dayIndex} onConfirmRadar={onConfirmRadar} />
        )}
        {tab === "radar" && <RadarTab bundle={bundle} />}
        {tab === "validation" && <ValidationTab bundle={bundle} />}
        {tab === "impact" && <ImpactTab bundle={bundle} zones={zones} />}
      </div>
    </aside>
  );
}

function AlertTab({
  bundle,
  zones,
  dayIndex,
  onConfirmRadar,
}: {
  bundle: CaseBundle;
  zones: PriorityZone[];
  dayIndex: number;
  onConfirmRadar: () => void;
}) {
  const critical = zones.filter((z) => z.tpi >= 0.6);
  const reached = critical.length > 0;
  const areaKm2 = critical.reduce((a, z) => a + z.area_km2, 0);
  const people = critical.reduce((a, z) => a + z.people, 0);

  return (
    <div className="space-y-3">
      <div
        className={`rounded-md border p-3 ${
          reached ? "border-red-800 bg-red-950/60" : "border-amber-800 bg-amber-950/40"
        }`}
      >
        <div className="flex items-center gap-2">
          <WarnIcon />
          <div>
            <p className={`text-sm font-bold tracking-wide ${reached ? "text-red-400" : "text-amber-400"}`}>
              {reached ? "TIPPING POINT REACHED" : "TIPPING POINT WATCH"}
            </p>
            <p className="text-[11px] text-zinc-400">
              {reached
                ? "High likelihood of landslide and/or flooding in monitored areas."
                : "Elevated risk in monitored areas — conditions trending toward the tipping point."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-5">
          <Stat big value={fmtKm2(areaKm2)} label="critical" />
          <Stat big value={fmtPeople(people)} label="people exposed" />
          <span className="ml-auto text-right text-[9px] leading-tight text-zinc-500">
            Illustrative<br />demo data.
          </span>
        </div>
      </div>

      {bundle.series && <TpiChart series={bundle.series} dayIndex={dayIndex} />}

      {bundle.mode === "live" && <LiveSources bundle={bundle} />}

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-zinc-300">
          Priority zones (TPI ≥ 0.60)
        </p>
        <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800">
          {zones.map((z) => (
            <li key={z.rank} className="flex items-center gap-2.5 px-2.5 py-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-red-700 text-[10px] font-bold text-white">
                {z.rank}
              </span>
              <span className="flex-1 text-xs text-zinc-200">{z.name}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${
                  z.class === "Critical" ? "bg-red-800 text-red-100" : "bg-orange-700 text-orange-100"
                }`}
              >
                {z.class.toUpperCase()}
              </span>
              <span className="w-14 text-right text-[11px] text-zinc-400">{z.area_km2.toFixed(1)} km²</span>
              <span className="w-14 text-right text-[11px] text-zinc-400">
                {fmtPeople(z.people)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onConfirmRadar}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan-600 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500"
      >
        <RadarIcon /> Confirm with NISAR radar →
      </button>
    </div>
  );
}

function RadarTab({ bundle }: { bundle: CaseBundle }) {
  const dd = bundle.data_dates ?? {};
  const pre = typeof dd.nisar_pre === "string" ? dd.nisar_pre : null;
  const post = typeof dd.nisar_post === "string" ? dd.nisar_post : null;
  const passes = Array.isArray(dd.nisar_passes) ? (dd.nisar_passes as NisarPass[]) : null;
  const hasPair = Boolean(bundle.flood && pre && post);

  return (
    <div className="space-y-3">
      {hasPair ? (
        <>
          <div className="rounded-md border border-zinc-800 p-3">
            <p className="mb-2 text-[11px] font-medium text-zinc-300">
              NISAR GCOV — before / after
            </p>
            <div className="relative flex overflow-hidden rounded">
              <SwipeHalf label={fmtDate(pre)} tone="before" />
              <div className="w-0.5 bg-cyan-400" />
              <SwipeHalf label={fmtDate(post)} tone="after" />
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">
              Swipe placeholder — real GCOV pair drops in via{" "}
              <code className="text-zinc-400">cog/flood_nisar.tif</code>.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Flooded area (NISAR GCOV)" value={fmtKm2(bundle.metrics?.flood?.area_km2)} accent="blue" />
            <StatCard label="Confirmed flood polygons" value={String(bundle.flood?.features.length ?? 0)} accent="blue" />
          </div>
          <p className="text-[10px] leading-snug text-zinc-500">
            Flood polygons are drawn on the map in dark blue (#2166AC, outline
            #08306B). Landslide coherence candidates appear in purple — they are
            candidates, never “confirmed scars”.
          </p>
        </>
      ) : (
        <div className="rounded-md border border-dashed border-zinc-700 p-4 text-center">
          <p className="text-xs font-medium text-zinc-300">Awaiting NISAR pair</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Radar confirmation runs within days of an acquisition over the AOI.
          </p>
        </div>
      )}

      {passes && <NisarPassList passes={passes} />}
    </div>
  );
}

// "Agora" fields from the now/ bundle (v4): updated-at, per-source data
// dates and the recent NISAR pass list. km² critical / people exposed are
// already in the banner; live TPI + D+1..D+3 are in the chart/timeline.
function LiveSources({ bundle }: { bundle: CaseBundle }) {
  const dd = bundle.data_dates ?? {};
  const passes = Array.isArray(dd.nisar_passes)
    ? (dd.nisar_passes as NisarPass[])
    : null;
  const rows = [
    ["IMERG Early — rain", dd.imerg],
    ["SMAP L4 — soil moisture", dd.smap],
    ["GEOS-FP — forecast D+1 to D+3", dd.geos_fp_issued],
  ] as const;

  return (
    <>
      <div className="rounded-md border border-zinc-800 p-3">
        <p className="mb-2 text-[11px] font-medium text-zinc-300">
          Live data sources
          {bundle.updated_at && (
            <span className="font-normal text-zinc-500">
              {" "}· updated {fmtDateTime(bundle.updated_at)}
            </span>
          )}
        </p>
        <ul className="space-y-1">
          {rows.map(
            ([label, v]) =>
              typeof v === "string" && (
                <li
                  key={label}
                  className="flex items-center justify-between text-[11px] text-zinc-400"
                >
                  <span>{label}</span>
                  <span className="text-zinc-500">{fmtDate(v)}</span>
                </li>
              )
          )}
        </ul>
      </div>
      {passes && <NisarPassList passes={passes} />}
    </>
  );
}

function NisarPassList({ passes }: { passes: NisarPass[] }) {
  return (
    <div className="rounded-md border border-zinc-800 p-3">
      <p className="mb-2 text-[11px] font-medium text-zinc-300">
        Recent NISAR passes over the area
      </p>
      <ul className="space-y-1.5">
        {passes.map((p, i) => (
          <li key={i} className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>{fmtDate(p.date)} · track {p.track}</span>
            {p.note && <span className="text-zinc-600">{p.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
};

function ValidationTab({ bundle }: { bundle: CaseBundle }) {
  const m = bundle.metrics;
  if (!m) {
    return (
      <div className="rounded-md border border-dashed border-zinc-700 p-4 text-center">
        <p className="text-xs font-medium text-zinc-300">No validation metrics yet</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Metrics are computed on replay cases against NISAR-confirmed flood
          maps and OPERA products. Switch to a replay case.
        </p>
      </div>
    );
  }
  const t = m.model?.threshold ?? 0.6;
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium text-zinc-300">
        Flood detection vs reference (NISAR/OPERA)
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="IoU" value={m.flood ? m.flood.iou.toFixed(2) : "—"} />
        <StatCard label="F1" value={m.flood ? m.flood.f1.toFixed(2) : "—"} />
        <StatCard label="Model AUC" value={m.model ? m.model.auc.toFixed(2) : "—"} />
        <StatCard
          label={`Precision @ ${t.toFixed(2)}`}
          value={m.model ? m.model.precision.toFixed(2) : "—"}
        />
        <StatCard
          label={`Recall @ ${t.toFixed(2)}`}
          value={m.model ? m.model.recall.toFixed(2) : "—"}
        />
        <StatCard label="Validated area" value={fmtKm2(m.flood?.area_km2)} />
      </div>
      <p className="text-[11px] font-medium text-zinc-300">Early warning</p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Median lead time"
          value={m.alert ? `${Math.round(m.alert.lead_hours_median)} h` : "—"}
          accent="green"
        />
        <StatCard
          label="Zones warned before event"
          value={fmtPct(m.alert?.warned_before_pct)}
          accent="green"
        />
      </div>
      <div className="rounded-md border border-zinc-800 p-3">
        <p className="text-[11px] font-medium text-zinc-300">Why radar</p>
        <p className="mt-1 text-[11px] text-zinc-400">
          Cloud cover during the event:{" "}
          <strong className="text-zinc-200">{fmtPct(m.cloud?.cloud_pct_during_event)}</strong>.
          Optical sensors were blind — SAR sees through.
        </p>
      </div>
      <p className="text-[10px] text-zinc-600">Illustrative demo data.</p>
    </div>
  );
}

function ImpactTab({ bundle, zones }: { bundle: CaseBundle; zones: PriorityZone[] }) {
  const m = bundle.metrics;
  const exposed = m?.impact?.people_exposed ?? zones.reduce((a, z) => a + z.people, 0);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="People exposed" value={fmtPeople(exposed)} accent="red" />
        <StatCard
          label="Flooded area"
          value={fmtKm2(m?.flood?.area_km2)}
          accent="blue"
        />
        <StatCard
          label="Lights-out area (Black Marble)"
          value={fmtPct(m?.impact?.lights_out_pct)}
          accent="amber"
        />
        <StatCard
          label="Priority zones"
          value={String(zones.length)}
        />
      </div>
      <div className="rounded-md border border-zinc-800 p-3">
        <p className="text-[11px] font-medium text-zinc-300">Exposure basis</p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400">
          People in TPI ≥ 0.60 cells, WorldPop/GPW estimate. Lights-out compares
          VIIRS Black Marble radiance before/after the event.
        </p>
      </div>
      <p className="text-[10px] text-zinc-600">Illustrative demo data.</p>
    </div>
  );
}

function SwipeHalf({ label, tone }: { label: string; tone: "before" | "after" }) {
  return (
    <div
      className={`relative h-28 flex-1 ${
        tone === "before"
          ? "bg-gradient-to-br from-zinc-800 via-zinc-900 to-[#0e1a26]"
          : "bg-gradient-to-br from-[#0e2a44] via-[#123a5c] to-[#0b1c2e]"
      }`}
    >
      <span className="absolute left-2 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
        {label}
      </span>
      {tone === "after" && (
        <span className="absolute bottom-2 right-2 rounded bg-[#2166AC]/80 px-1.5 py-0.5 text-[10px] text-white">
          open water
        </span>
      )}
    </div>
  );
}

function Stat({ big, value, label }: { big?: boolean; value: string; label: string }) {
  return (
    <div>
      <p className={`font-bold text-zinc-100 ${big ? "text-xl" : "text-base"}`}>{value}</p>
      <p className="text-[10px] text-zinc-400">{label}</p>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "red" | "blue" | "green" | "amber" }) {
  const colors = {
    red: "text-red-400",
    blue: "text-sky-400",
    green: "text-emerald-400",
    amber: "text-amber-400",
  } as const;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5">
      <p className={`text-lg font-bold ${accent ? colors[accent] : "text-zinc-100"}`}>{value}</p>
      <p className="text-[10px] leading-tight text-zinc-500">{label}</p>
    </div>
  );
}

function WarnIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" aria-hidden>
      <path d="M12 3 2 20h20z" strokeLinejoin="round" />
      <path d="M12 10v4M12 17.5v.5" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="8" cy="8" r="6.5" strokeDasharray="3 2" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <path d="M8 8 12.5 3.5" />
    </svg>
  );
}
