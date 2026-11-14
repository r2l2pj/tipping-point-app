// Shared inline stat + stat card for the side-panel tabs. All body text stays
// at >= 12px (text-xs and up) per the v4 panel spec.
// When `absent` is true the stat renders a literal lowercase "pending" instead
// of the value — an honest placeholder for data the pipeline has not produced,
// never a fabricated number or a bare dash.
const PendingValue = ({ className }: { className: string }) => (
  <p className={`font-normal text-zinc-600 ${className}`}>pending</p>
);

export function Stat({
  big,
  value,
  label,
  absent,
}: {
  big?: boolean;
  value: string;
  label: string;
  absent?: boolean;
}) {
  return (
    <div>
      {absent ? (
        <PendingValue className={big ? "text-xl" : "text-base"} />
      ) : (
        <p className={`font-bold text-zinc-100 ${big ? "text-xl" : "text-base"}`}>
          {value}
        </p>
      )}
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent,
  absent,
}: {
  label: string;
  value: string;
  accent?: "red" | "blue" | "green" | "amber";
  absent?: boolean;
}) {
  const colors = {
    red: "text-red-400",
    blue: "text-sky-400",
    green: "text-emerald-400",
    amber: "text-amber-400",
  } as const;
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5">
      {absent ? (
        <PendingValue className="text-lg" />
      ) : (
        <p className={`text-lg font-bold ${accent ? colors[accent] : "text-zinc-100"}`}>
          {value}
        </p>
      )}
      <p className="text-xs leading-tight text-zinc-500">{label}</p>
    </div>
  );
}
