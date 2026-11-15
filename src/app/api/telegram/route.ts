// Telegram bot webhook. Cred-blocked by design: 503 until TELEGRAM_SECRET +
// TELEGRAM_TOKEN are configured. After the shared-secret check it answers
// 200 for delivery errors; store failures answer 503 so Telegram can
// retry a registration or deletion instead of silently losing it.
import { handleUpdate, type TelegramUpdate } from "@/lib/telegram/bot";
import { depsFromEnv } from "@/lib/telegram/deps";

export const maxDuration = 30;

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_SECRET;
  if (!secret || !process.env.TELEGRAM_TOKEN) {
    return Response.json({ telegram: "unconfigured" }, { status: 503 });
  }
  if (request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    await handleUpdate(update as TelegramUpdate, depsFromEnv());
  } catch (err) {
    console.error("telegram update failed:", err);
    if (err instanceof Error && err.message === "telegram store: configured SQLite unavailable") {
      return Response.json({ telegram: "store unavailable" }, { status: 503 });
    }
  }
  return Response.json({ ok: true });
}
