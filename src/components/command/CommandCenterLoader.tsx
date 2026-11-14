import { Suspense } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import { canonicalCaseId } from "@/lib/contract";
import { getAlerts, getCaseBundle, getEventsIndex, getRootManifest } from "@/lib/data";
import CommandCenter from "./CommandCenter";
import { buildAlertList } from "./model/alerts";
import type { CcBundle } from "./model/types";

const body = Inter({ variable: "--cc-font-body", subsets: ["latin"] });
const display = Space_Grotesk({ variable: "--cc-font-display", subsets: ["latin"], weight: ["600", "700"] });
const fontClass = `${body.variable} ${display.variable}`;

const NOW_BBOX: [number, number, number, number] = [-58, -34, -48, -22.5];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

// `_null_reasons` of a case node: why a product is null. The loader in
// src/lib does not carry it, so it is read from the root manifest here.
function nullReasons(root: unknown, id: string): Record<string, string> | undefined {
  const cases = isRecord(root) && isRecord(root.cases) ? root.cases : undefined;
  const node = cases?.[canonicalCaseId(id)] ?? cases?.[id];
  const reasons = isRecord(node) ? node._null_reasons : undefined;
  if (!isRecord(reasons)) return undefined;
  const out = Object.fromEntries(
    Object.entries(reasons).filter(([, v]) => typeof v === "string")
  ) as Record<string, string>;
  return Object.keys(out).length ? out : undefined;
}

function liveRunTime(root: unknown): string | undefined {
  const cases = isRecord(root) && isRecord(root.cases) ? root.cases : undefined;
  const node = cases?.now;
  return isRecord(node) && typeof node.updated_at === "string" ? node.updated_at : undefined;
}

// Loads the case bundles and builds the alert list once, on the server, for
// both routes (/ and /alerts). The alert list is built here because
// candidatesToAlerts reads the clock when no issue time is given.
async function Loaded({ basePath }: { basePath?: string }) {
  const [index, root] = await Promise.all([
    getEventsIndex().catch(() => null),
    getRootManifest().catch(() => undefined),
  ]);
  const cases: CcBundle[] = [];
  // A single bad case must not blank the whole screen: skip it.
  for (const e of index?.events ?? []) {
    const bundle: CcBundle | null = await getCaseBundle(e.id, e.title, e.bbox, e.reference_date).catch(() => null);
    if (bundle) cases.push({ ...bundle, nullReasons: nullReasons(root, e.id) });
  }
  // Live case. No reference date is passed: the loader derives it from the
  // data (manifest run time, data dates), never from a fixed date.
  const now: CcBundle | null = await getCaseBundle("now", "Now — Southern Brazil", NOW_BBOX).catch(() => null);
  // Run time of the live case: the `updated_at` of the live node itself. The
  // loader falls back to the root manifest time, which is the time of the
  // data snapshot and would make an empty live seed read as a fresh run.
  const live: CcBundle | null = now?.manifest
    ? { ...now, updated_at: liveRunTime(root), nullReasons: nullReasons(root, "now") }
    : null;
  if (live) cases.push(live);

  const legacy = await getAlerts().catch(() => null);
  const alertList = buildAlertList({ now: live, legacy });

  return (
    <CommandCenter
      cases={cases}
      alertList={alertList}
      botUrl={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL || undefined}
      fontClass={fontClass}
      basePath={basePath}
    />
  );
}

export default function CommandCenterLoader({ basePath }: { basePath?: string }) {
  return (
    <Suspense
      fallback={
        <div className={`cc-root flex h-screen items-center justify-center text-sm ${fontClass}`}>
          Loading data…
        </div>
      }
    >
      <Loaded basePath={basePath} />
    </Suspense>
  );
}
