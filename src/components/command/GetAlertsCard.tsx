import { Icon, ICON } from "./ui";

// Opens the Telegram bot. The bot owns consent and location; this page reads
// no location and stores nothing. Hidden when no bot address is configured.
export default function GetAlertsCard({ botUrl }: { botUrl: string | undefined }) {
  if (!botUrl) return null;
  return (
    <section aria-label="Get alerts" className="rounded-[10px] border border-cc-accent-line bg-cc-accent-soft px-3.5 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Icon d={ICON.send} size={30} fill strokeWidth={1.4} className="shrink-0 text-cc-accent" />
        <div className="min-w-0 flex-[1_1_150px] font-cc-display text-[17px] font-semibold leading-tight">Get alerts for an area</div>
        <a href={botUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-[38px] items-center gap-2 rounded-full bg-cc-accent px-3.5 text-[13px] font-semibold text-white">
          <Icon d={ICON.send} size={16} fill strokeWidth={1.4} /> Get alerts on Telegram
        </a>
      </div>
      <p className="mt-1 text-xs text-cc-ink">
        The Telegram bot asks for your consent and for an approximate location. This page reads no location and stores nothing.
      </p>
    </section>
  );
}
