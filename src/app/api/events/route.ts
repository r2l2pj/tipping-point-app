import { getEventsIndex } from "@/lib/data";

export async function GET() {
  try {
    return Response.json(await getEventsIndex());
  } catch {
    return Response.json(
      { error: "data index missing — run `bun run sync:data`" },
      { status: 503 }
    );
  }
}
