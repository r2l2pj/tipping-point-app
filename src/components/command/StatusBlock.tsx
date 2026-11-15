import { freshnessText, type DataStatus } from "./model/dataStatus";
import type { StatusChip } from "./model/status";
import { Icon, ICON } from "./ui";

const TONE: Record<StatusChip["kind"], string> = {
  reached: "border-[#e2a3ad] bg-cc-danger-soft text-cc-danger",
  forecast: "border-[#b9b7e6] bg-cc-forecast text-cc-forecast-ink",
  "forecast-later": "border-[#b9b7e6] bg-cc-forecast text-cc-forecast-ink",
  below: "border-cc-accent-line bg-cc-accent-soft text-cc-accent",
  "no-data": "border-cc-line-strong bg-cc-well text-cc-muted",
};

// Status chip, one sentence, and the notice for last-saved or stale data.
export default function StatusBlock({
  chip,
  status,
  stepLabel,
  children,
}: {
  chip: StatusChip;
  status: DataStatus;
  stepLabel: string | undefined;
  children?: React.ReactNode; // for example the Replay offer in an empty Now
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h1 className="m-0 font-cc-display text-[21px] font-semibold leading-tight">Situation overview</h1>
        <span data-chip={chip.kind} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-bold tracking-[0.02em] ${TONE[chip.kind]}`}>
          {chip.kind !== "below" && chip.kind !== "no-data" && <Icon d={ICON.warn} size={14} strokeWidth={2.2} />}
          {chip.label}
          {chip.source && <span className="font-semibold">· {chip.source}</span>}
        </span>
      </div>
      {stepLabel && <p className="mt-0.5 text-xs text-cc-faint">Step: {stepLabel}</p>}
      <p className="mt-1 text-[13px] text-cc-muted">{chip.sentence}</p>
      {(status.kind === "last-saved" || status.kind === "stale") && (
        <p data-notice={status.kind} className="mt-1.5 flex items-center gap-1.5 rounded-md bg-cc-warn-soft px-2 py-1 text-xs font-semibold text-cc-warn">
          <Icon d={ICON.warn} size={14} /> {freshnessText(status)}
        </p>
      )}
      {children}
    </div>
  );
}
