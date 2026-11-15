import type { ImportanceView } from "../model/ml";

// What drives the trigger model: XGBoost total-gain share per feature group
// (sums to 100%), with the drop in TEST PR-AUC when the group is shuffled.
export default function GroupImportanceChart({ importance }: { importance: ImportanceView }) {
  const max = Math.max(...importance.groups.map((g) => g.gain), 0.0001);
  return (
    <section aria-label="What the model relies on" data-ml-importance className="rounded-md border border-cc-line p-3">
      <p className="mb-1 text-xs font-medium text-cc-ink">What the model relies on (share of XGBoost gain)</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {importance.groups.map((g) => (
          <li key={g.group} className="text-xs">
            <div className="flex justify-between gap-2">
              <span className="font-semibold">{g.label}</span>
              <span className="tabular-nums">{Math.round(g.gain * 100)}%</span>
            </div>
            <div className="mt-0.5 h-2 rounded-sm bg-cc-well">
              <div className="h-2 rounded-sm bg-[#08306B]" style={{ width: `${(g.gain / max) * 100}%` }} />
            </div>
            <div className="text-cc-faint">
              {g.top.length ? `top: ${g.top.join(", ")}` : "no gain"}
              {g.permDrop !== undefined
                ? g.permDrop > 0
                  ? ` · shuffling it costs ${g.permDrop.toFixed(3)} TEST PR-AUC`
                  : ` · shuffling it does not lower TEST PR-AUC (${g.permDrop.toFixed(3)})`
                : ""}
            </div>
          </li>
        ))}
      </ul>
      {importance.model && <p className="mt-1 text-xs text-cc-faint">Model: {importance.model}</p>}
    </section>
  );
}
