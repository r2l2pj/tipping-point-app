// Telegram bot webhook. Cred-blocked by design: 503 until TELEGRAM_SECRET +
// TELEGRAM_TOKEN are configured. After the shared-secret check it always
// answers 200 — handler errors are logged, never returned, so Telegram
// doesn't retry-storm us.
import { handleUpdate, type TelegramUpdate } from "@/lib/telegram/bot";
import { depsFromEnv } from "@/lib/telegram/deps";

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
  }
  return Response.json({ ok: true });
}
