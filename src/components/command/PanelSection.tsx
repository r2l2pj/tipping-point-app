import type { ReactNode } from "react";
import { Icon, ICON } from "./ui";

// One labelled group of the Situation panel. The order is response first,
// prediction second (ruling L27): what is on the ground, then the forecast.
// A section folds, so a reader can close what they have read.
export default function PanelSection({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id?: string;
  hint?: string; // one short line under the title: what the section answers
  children: ReactNode;
}) {
  return (
    <details open id={id} data-panel-section className="group/section scroll-mt-24 border-t border-cc-line pt-2.5 first:border-t-0 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 grow">
          <h2 className="m-0 font-cc-display text-[17px] font-semibold leading-tight">{label}</h2>
          {hint && <span className="block text-xs text-cc-faint">{hint}</span>}
        </span>
        <Icon d={ICON.chevronUp} size={18} strokeWidth={2.2} className="shrink-0 rotate-180 text-cc-muted group-open/section:rotate-0" />
      </summary>
      <div className="mt-2.5 flex flex-col gap-3">{children}</div>
    </details>
  );
}
