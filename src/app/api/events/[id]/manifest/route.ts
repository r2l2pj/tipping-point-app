import { canonicalCaseId } from "@/lib/contract";
import { getManifest, getRootManifest } from "@/lib/data";
import type { EventManifest } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]/manifest">) {
  const { id } = await ctx.params;
  const canonical = canonicalCaseId(id);
  // v4 root manifest: one `cases` entry per case (canonical underscore keys).
  const root = await getRootManifest();
  const entry = root?.cases?.[canonical] ?? root?.cases?.[id];
  if (entry) {
    const manifest: EventManifest = {
      event: id,
      event_id: entry.event_id,
      mode: entry.mode,
      bounds: entry.bounds,
      updated_at: entry.updated_at ?? root?.updated_at,
      data_dates: entry.data_dates,
      layers: entry.layers ?? [],
    };
    return Response.json(manifest);
  }
  // Not in the root manifest — legacy per-case manifest.json may still exist.
  try {
    return Response.json(await getManifest(canonical));
  } catch {
    return Response.json({ error: `no manifest for event ${id}` }, { status: 404 });
  }
}
