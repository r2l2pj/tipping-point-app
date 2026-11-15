"use client";

// L52 U1: the right panel as tabs (content moved, nothing deleted).
export type PanelTab = "overview" | "forecast" | "radar" | "places" | "sources";
const LABEL: Record<PanelTab, string> = {
  overview: "Overview", forecast: "Forecast", radar: "Radar (NISAR)", places: "Places", sources: "Sources",
};

export default function PanelTabs({ tabs, tab, onTab }: { tabs: PanelTab[]; tab: PanelTab; onTab: (t: PanelTab) => void }) {
  return (
    <div role="tablist" aria-label="Panel" className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-1 bg-cc-surface px-1 pb-1.5" data-panel-tabs>
      {tabs.map((t) => (
        <button key={t} type="button" role="tab" aria-selected={tab === t} data-tab={t} onClick={() => onTab(t)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-cc-accent text-white" : "text-cc-ink hover:bg-cc-well"}`}>
          {LABEL[t]}
        </button>
      ))}
    </div>
  );
}
