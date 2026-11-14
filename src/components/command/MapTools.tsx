"use client";

import { Icon, ICON } from "./ui";

const btn =
  "inline-flex h-10 w-10 items-center justify-center bg-white text-cc-ink shadow-[0_2px_8px_rgba(0,0,0,0.35)]";

// Layers toggle, recenter and zoom. During a comparison the same buttons act
// on the comparison maps (the caller passes the right handlers).
export default function MapTools({
  layersShown,
  onToggleLayers,
  onRecenter,
  onZoomIn,
  onZoomOut,
  className = "",
  style,
}: {
  layersShown: boolean;
  onToggleLayers: () => void;
  onRecenter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const label = layersShown ? "Hide the Layers column" : "Show the Layers column";
  return (
    <div className={`flex flex-col gap-2 ${className}`} style={style}>
      <button type="button" onClick={onToggleLayers} aria-pressed={layersShown} aria-label={label} title={label}
        data-tool="layers" className={`${btn} rounded-[10px]`}>
        <Icon d={ICON.layers} size={22} />
      </button>
      <button type="button" onClick={onRecenter} aria-label="Fit the map to the whole area" title="Fit the map to the whole area"
        data-tool="recenter" className={`${btn} rounded-[10px]`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="1.2" fill="currentColor" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        </svg>
      </button>
      <div className="flex flex-col overflow-hidden rounded-[10px] shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
        <button type="button" onClick={onZoomIn} aria-label="Zoom in" data-tool="zoom-in" className={`${btn} border-b border-cc-line shadow-none`}>
          <Icon d={ICON.plus} size={20} strokeWidth={2.2} />
        </button>
        <button type="button" onClick={onZoomOut} aria-label="Zoom out" data-tool="zoom-out" className={`${btn} shadow-none`}>
          <Icon d={ICON.minus} size={20} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
