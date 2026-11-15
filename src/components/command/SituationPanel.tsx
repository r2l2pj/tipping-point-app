import type { ReactNode } from "react";

// Frame of the right panel (Situation overview or Public Alerts).
export default function SituationPanel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-cc-line bg-cc-surface px-4 pb-3 pt-2.5 min-[900px]:max-h-full min-[900px]:w-[420px] min-[900px]:overflow-y-auto min-[900px]:shadow-[0_4px_18px_rgba(0,0,0,0.28)] min-[1280px]:w-[440px]"
    >
      {children}
    </aside>
  );
}
