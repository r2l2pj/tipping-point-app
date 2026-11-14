import type { SourceRow } from "./model/sources";

// Data sources: absolute date first, age second.
export default function SourceAges({ rows }: { rows: SourceRow[] }) {
  return (
    <div className="min-w-[260px] flex-[0_1_440px] border-cc-line min-[900px]:border-l min-[900px]:pl-4">
      <div className="mb-1 text-[13px] font-semibold">Data sources (NASA) - dates in BRT</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        {rows.map((r) => (
          <div key={r.id} className="min-w-0">
            <dt className="text-[13px] font-semibold leading-tight">{r.name}</dt>
            <dd className={`text-xs ${r.missing ? "italic text-cc-faint" : "text-cc-muted"}`}>
              {r.date}{r.age ? ` · ${r.age}` : ""}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
