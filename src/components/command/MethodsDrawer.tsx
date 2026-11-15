// "Methods" for judges (conductor): closed by default, links to the public
// READMEs. Section anchors are GitHub heading slugs on main.
const DATA = "https://github.com/r2l2pj/tipping-point-data/blob/main/README.md";
const APP = "https://github.com/r2l2pj/tipping-point-app/blob/main/README.md";

export const METHODS_LINKS: { label: string; sub: string; href: string }[] = [
  { label: "TPI formula", sub: "geometric mean of rain, soil and terrain scores", href: `${DATA}#method-and-thresholds` },
  { label: "Data used", sub: "NASA observations; forecast rain from NOAA GFS", href: `${DATA}#data-sources-nasa--partners` },
  { label: "Validation", sub: "radar vs OPERA, landslide inventories, held-out ML test", href: `${APP}#validation` },
  { label: "Limitations", sub: "what the index and the radar cannot do", href: `${DATA}#declared-limitations` },
  { label: "Project document", sub: "the full plan (PT-BR)", href: "https://github.com/r2l2pj/tipping-point-app/blob/main/docs/PLAN.md" },
];

export default function MethodsDrawer() {
  return (
    <details data-methods className="relative text-sm">
      <summary className="cursor-pointer list-none rounded-full border border-cc-line-strong bg-cc-surface px-3 py-1 text-xs font-semibold">
        Methods
      </summary>
      <nav
        aria-label="Methods"
        className="absolute right-0 top-full z-30 mt-1 w-[300px] rounded-lg border border-cc-line bg-cc-surface p-2.5 shadow-lg"
      >
        <ul className="m-0 list-none space-y-1.5 p-0">
          {METHODS_LINKS.map((l) => (
            <li key={l.label}>
              <a href={l.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-cc-accent underline-offset-2 hover:underline">
                {l.label}
              </a>
              <span className="block text-xs text-cc-muted">{l.sub}</span>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
