import { getEventsIndex, getRootManifest } from "@/lib/data";

export async function GET() {
  try {
    const [index, root] = await Promise.all([
      getEventsIndex(),
      getRootManifest(),
    ]);
    // v4: when the root manifest resolves, surface its case keys + stamp.
    return Response.json(
      root
        ? {
            ...index,
            cases: Object.keys(root.cases ?? {}),
            updated_at: root.updated_at,
          }
        : index
    );
  } catch {
    return Response.json(
      { error: "data index missing — run `bun run sync:data`" },
      { status: 503 }
    );
  }
}
