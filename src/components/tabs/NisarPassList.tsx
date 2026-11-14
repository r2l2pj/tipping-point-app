import type { NisarPass } from "@/lib/types";
import { fmtDate } from "@/lib/layers";

// Recent NISAR acquisitions over the AOI — rendered from whatever
// data_dates.nisar_passes carries (e.g. wa_2025: Nov 10 no-event reference,
// Dec 4 pre, Dec 16 post).
export default function NisarPassList({ passes }: { passes: NisarPass[] }) {
  if (passes.length === 0) return null;
  return (
    <div className="rounded-md border border-zinc-800 p-3">
      <p className="mb-2 text-xs font-medium text-zinc-300">
        Recent NISAR passes over the area
      </p>
      <ul className="space-y-1.5">
        {passes.map((p, i) => (
          <li
            key={i}
            className="flex items-center justify-between text-xs text-zinc-400"
          >
            <span>
              {fmtDate(p.date)} · track {p.track}
            </span>
            {p.note && <span className="text-zinc-600">{p.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
