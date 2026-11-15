import type { ReactNode } from "react";

// One labelled group of the Situation panel. The order is response first,
// prediction second (ruling L27): what is on the ground, then the forecast.
export default function PanelSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-2.5 border-t border-cc-line pt-2.5 first:border-t-0 first:pt-0">
      <h2 className="m-0 font-cc-display text-base font-semibold">{label}</h2>
      {children}
    </section>
  );
}
