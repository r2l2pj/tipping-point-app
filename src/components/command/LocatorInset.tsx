// Static locator drawn from the case bounds: where the map area sits on a
// latitude / longitude grid. It is not a second map and carries no data.
type BBox = [number, number, number, number];

const HALF = 20; // degrees around the center of the case

export default function LocatorInset({ bbox, className = "" }: { bbox: BBox; className?: string }) {
  const [w, s, e, n] = bbox;
  const cx = (w + e) / 2;
  const cy = (s + n) / 2;
  const x = (lon: number) => ((lon - (cx - HALF)) / (2 * HALF)) * 100;
  const y = (lat: number) => (((cy + HALF) - lat) / (2 * HALF)) * 100;
  const STEP = 20;
  const lines = (from: number) => {
    const first = Math.ceil((from - HALF + 4) / STEP) * STEP;
    return [first, first + STEP].filter((v) => v < from + HALF - 4);
  };
  const fmtLat = (v: number) => `${Math.abs(v)}°${v < 0 ? "S" : v > 0 ? "N" : ""}`;
  const fmtLon = (v: number) => `${Math.abs(v)}°${v < 0 ? "W" : v > 0 ? "E" : ""}`;
  return (
    <div
      role="img"
      aria-label={`Locator: the map area spans ${fmtLat(s)} to ${fmtLat(n)}, ${fmtLon(w)} to ${fmtLon(e)}`}
      className={`h-[104px] w-[104px] rounded-[10px] border-[1.5px] border-white/75 bg-[rgba(15,24,26,0.82)] p-1 ${className}`}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" aria-hidden="true">
        {lines(cx).map((lon) => (
          <g key={`x${lon}`}>
            <line x1={x(lon)} x2={x(lon)} y1={0} y2={100} stroke="rgba(255,255,255,0.3)" strokeWidth={0.8} />
            <text x={x(lon) + 1.5} y={98} fontSize={12} fill="#ffffff">{fmtLon(lon)}</text>
          </g>
        ))}
        {lines(cy).map((lat) => (
          <g key={`y${lat}`}>
            <line y1={y(lat)} y2={y(lat)} x1={0} x2={100} stroke="rgba(255,255,255,0.3)" strokeWidth={0.8} />
            <text x={1.5} y={y(lat) - 2} fontSize={12} fill="#ffffff">{fmtLat(lat)}</text>
          </g>
        ))}
        <rect x={x(w)} y={y(n)} width={Math.max(3, x(e) - x(w))} height={Math.max(3, y(s) - y(n))}
          fill="rgba(255,255,255,0.35)" stroke="#ffffff" strokeWidth={2} />
      </svg>
    </div>
  );
}
