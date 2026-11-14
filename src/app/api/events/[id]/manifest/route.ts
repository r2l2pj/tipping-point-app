import { getManifest } from "@/lib/data";

export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]/manifest">) {
  const { id } = await ctx.params;
  try {
    return Response.json(await getManifest(id));
  } catch {
    return Response.json({ error: `no manifest for event ${id}` }, { status: 404 });
  }
}
