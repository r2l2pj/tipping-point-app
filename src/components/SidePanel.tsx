"use client";

import type { CaseBundle, PriorityZone } from "@/lib/types";
import AlertTab from "./tabs/AlertTab";
import ImpactTab from "./tabs/ImpactTab";
import RadarTab from "./tabs/RadarTab";
import ValidationTab from "./tabs/ValidationTab";

export type TabKey = "alert" | "radar" | "validation" | "impact";

const TABS: { key: TabKey; label: string }[] = [
  { key: "alert", label: "ALERT" },
  { key: "radar", label: "RADAR" },
  { key: "validation", label: "Did we get it right?" },
  { key: "impact", label: "IMPACT" },
];

export default function SidePanel({
  tab,
  onTab,
  bundle,
  zones,
  dayIndex,
  onConfirmRadar,
  onZoneClick,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  bundle: CaseBundle;
  zones: PriorityZone[];
  dayIndex: number;
  onConfirmRadar: () => void;
  onZoneClick?: (z: PriorityZone) => void;
}) {
  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-zinc-800 bg-[#0d1117]">
      <nav className="flex border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            className={`flex-1 px-2 py-2.5 text-xs font-semibold tracking-wider ${
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
          <AlertTab
            bundle={bundle}
            zones={zones}
            dayIndex={dayIndex}
            onConfirmRadar={onConfirmRadar}
            onZoneClick={onZoneClick}
          />
        )}
        {tab === "radar" && <RadarTab bundle={bundle} />}
        {tab === "validation" && <ValidationTab bundle={bundle} />}
        {tab === "impact" && <ImpactTab bundle={bundle} />}
      </div>
    </aside>
  );
}
