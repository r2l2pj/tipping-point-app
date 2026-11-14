import { NeonStore } from "./neon-store";
import memoryStore from "./store";

const testModule = "bun:test";
const { describe, expect, test } = await import(testModule);
const databaseUrl = "postgresql://app:fake-password@ep-example.neon.tech/app?sslmode=require";
const subscriber = {
  lat: -29.241,
  lon: -51.879,
  consent: true,
  last_class: 2,
  last_alert_ts: 1735689600123,
  current_label: "alto'); DROP TABLE subscribers; --",
  data_date: "2025-01-01",
};

function fakeFetch(response = Response.json({ rows: [] })) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return response;
  }) as typeof fetch;
  return { impl, calls };
}

function body(call: { init?: RequestInit }): { query: string; params: unknown[] } {
  return JSON.parse(String(call.init?.body));
}

describe("NeonStore", () => {
  test("maps object rows, numeric strings and SQL epoch milliseconds", async () => {
    const { impl, calls } = fakeFetch(Response.json({ rows: [{
      ...subscriber,
      lat: "-29.241",
      lon: "-51.879",
      last_class: "2",
      last_alert_ts: "1735689600123",
    }] }));
    expect(await new NeonStore(databaseUrl, impl).get(42)).toEqual(subscriber);
    expect(body(calls[0])).toEqual({
      query: "SELECT lat,lon,consent,last_class,EXTRACT(EPOCH FROM last_alert_ts)::float*1000 AS last_alert_ts,current_label,data_date FROM subscribers WHERE chat_id = $1",
      params: ["42"],
    });
    expect(calls[0].url).toBe("https://ep-example.neon.tech/sql");
    expect(calls[0].init?.method).toBe("POST");
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("Neon-Connection-String")).toBe(databaseUrl);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.has("Neon-Raw-Text-Output")).toBe(false);
    expect(headers.has("Neon-Array-Mode")).toBe(false);
    expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("returns null for a missing subscriber", async () => {
    const { impl } = fakeFetch();
    expect(await new NeonStore(databaseUrl, impl).get("missing")).toBeNull();
  });

  test("handles nullable columns without NaN or null optional strings", async () => {
    const { impl } = fakeFetch(Response.json({ rows: [{
      lat: null, lon: null, consent: false, last_class: null,
      last_alert_ts: null, current_label: null, data_date: null,
    }] }));
    expect(await new NeonStore(databaseUrl, impl).get(42)).toEqual({
      lat: 0, lon: 0, consent: false, last_class: 0, last_alert_ts: 0,
    });
  });

  test("upserts all fields with eight parameters and no rounding or interpolation", async () => {
    const { impl, calls } = fakeFetch();
    await new NeonStore(databaseUrl, impl).set("chat' OR true --", subscriber);
    const { query, params } = body(calls[0]);
    expect(query).toStartWith("INSERT INTO subscribers");
    expect(query).toContain("ON CONFLICT (chat_id) DO UPDATE SET");
    expect(query).toContain("to_timestamp($6/1000.0)");
    for (const field of ["lat", "lon", "consent", "last_class", "last_alert_ts", "current_label", "data_date"]) {
      expect(query).toContain(`${field}=EXCLUDED.${field}`);
    }
    expect(params).toEqual(["chat' OR true --", -29.241, -51.879, true, 2, 1735689600123, subscriber.current_label, "2025-01-01"]);
    for (const value of [params[0], params[1], params[2], params[5], params[6], params[7]]) {
      expect(query).not.toContain(String(value));
    }
  });

  test("writes absent optional fields as null", async () => {
    const { impl, calls } = fakeFetch();
    await new NeonStore(databaseUrl, impl).set(42, {
      lat: 0, lon: 0, consent: false, last_class: 0, last_alert_ts: 0,
    });
    expect(body(calls[0]).params).toEqual(["42", 0, 0, false, 0, 0, null, null]);
  });

  test("deletes by parameterized chat id, including missing records", async () => {
    const { impl, calls } = fakeFetch();
    await new NeonStore(databaseUrl, impl).delete(42);
    expect(body(calls[0])).toEqual({
      query: "DELETE FROM subscribers WHERE chat_id = $1", params: ["42"],
    });
  });

  for (const status of [400, 401, 500]) {
    test(`rejects HTTP ${status} without echoing credentials or values`, async () => {
      const { impl } = fakeFetch(new Response(JSON.stringify({ message: `${databaseUrl} ${subscriber.current_label}` }), { status }));
      const operation = new NeonStore(databaseUrl, impl).set(42, subscriber);
      await expect(operation).rejects.toThrow(`neon store: ${status} query failed`);
      await expect(operation).rejects.not.toThrow("fake-password");
      await expect(operation).rejects.not.toThrow(databaseUrl);
      await expect(operation).rejects.not.toThrow(subscriber.current_label);
    });
  }

  for (const response of [{}, { rows: null }]) {
    test(`rejects missing rows: ${JSON.stringify(response)}`, async () => {
      const { impl } = fakeFetch(Response.json(response));
      await expect(new NeonStore(databaseUrl, impl).get(42)).rejects.toThrow("neon store: 200 missing rows");
    });
  }

  test("rejects malformed JSON safely", async () => {
    const { impl } = fakeFetch(new Response("not json"));
    await expect(new NeonStore(databaseUrl, impl).get(42)).rejects.toThrow("neon store: 200 invalid response");
  });

  test("sanitizes network failures", async () => {
    const impl = (async () => { throw new Error(databaseUrl); }) as unknown as typeof fetch;
    await expect(new NeonStore(databaseUrl, impl).get(42)).rejects.toThrow("neon store: 0 request failed");
  });

  test("rejects malformed connection strings without echoing them", () => {
    for (const url of ["", "fake-password", "https://user:fake-password@example.com/db", "postgresql:///db", "postgresql://user@host/"]) {
      expect(() => new NeonStore(url)).toThrow("neon store: 0 invalid DATABASE_URL");
    }
  });

  for (const [label, url] of [["missing", undefined], ["malformed", "malformed"], ["configured", databaseUrl]]) {
    test(`deps selects the expected store for ${label} DATABASE_URL`, async () => {
      const saved = process.env.DATABASE_URL;
      try {
        if (url === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = url;
        const modulePath = `./deps.ts?neon-test=${label}`;
        const { depsFromEnv } = await import(modulePath);
        if (url === databaseUrl) expect(depsFromEnv().store).toBeInstanceOf(NeonStore);
        else expect(depsFromEnv().store).toBe(memoryStore);
        expect(depsFromEnv()).toBe(depsFromEnv());
      } finally {
        if (saved === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = saved;
      }
    });
  }
});
