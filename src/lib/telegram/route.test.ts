// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { POST } from "@/app/api/telegram/route";
import { depsFromEnv } from "./deps";

const SECRET = "s3cret";
const saved = {
  secret: process.env.TELEGRAM_SECRET,
  token: process.env.TELEGRAM_TOKEN,
};

const req = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

const authorized = (body: string) =>
  req(body, { "x-telegram-bot-api-secret-token": SECRET });

beforeEach(() => {
  process.env.TELEGRAM_SECRET = SECRET;
  process.env.TELEGRAM_TOKEN = "token";
});

afterAll(() => {
  if (saved.secret === undefined) delete process.env.TELEGRAM_SECRET;
  else process.env.TELEGRAM_SECRET = saved.secret;
  if (saved.token === undefined) delete process.env.TELEGRAM_TOKEN;
  else process.env.TELEGRAM_TOKEN = saved.token;
});

describe("POST /api/telegram", () => {
  test("503 when TELEGRAM_SECRET is unset (cred-blocked)", async () => {
    delete process.env.TELEGRAM_SECRET;
    const res = await POST(authorized("{}"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ telegram: "unconfigured" });
  });

  test("503 when TELEGRAM_TOKEN is unset", async () => {
    delete process.env.TELEGRAM_TOKEN;
    const res = await POST(authorized("{}"));
    expect(res.status).toBe(503);
  });

  test("403 without or with the wrong secret header", async () => {
    expect((await POST(req("{}"))).status).toBe(403);
    const res = await POST(
      req("{}", { "x-telegram-bot-api-secret-token": "wrong" })
    );
    expect(res.status).toBe(403);
  });

  test("400 on an invalid JSON body", async () => {
    const res = await POST(authorized("not-json{"));
    expect(res.status).toBe(400);
  });

  test("200 {ok:true} on an authorized update", async () => {
    const res = await POST(authorized(JSON.stringify({ update_id: 1 })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("503 on a failed subscriber deletion so Telegram can retry", async () => {
    const store = depsFromEnv().store;
    const original = store.delete;
    const error = console.error;
    try {
      store.delete = async () => { throw new Error("telegram store: configured SQLite unavailable"); };
      console.error = () => {};
      const res = await POST(authorized(JSON.stringify({ message: { chat: { id: 42 }, text: "/parar" } })));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ telegram: "store unavailable" });
    } finally {
      store.delete = original;
      console.error = error;
    }
  });
});
