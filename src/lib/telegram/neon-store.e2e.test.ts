import { describe, expect, test } from "bun:test";
import { NeonStore } from "./neon-store";
import type { Subscriber, SubscriberStore } from "./store";

const skipLive = !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("sqlite:");
const round2 = (value: number) => Math.round(value * 100) / 100;

describe("telegram store e2e (live neon)", () => {
  if (skipLive)
    console.log("telegram store e2e: skipped — set DATABASE_URL to a non-SQLite database");

  test.skipIf(skipLive)(
    "persists rounded coordinates, consent and updates, then deletes the subscriber",
    async () => {
      const store: SubscriberStore = new NeonStore(process.env.DATABASE_URL!);
      const chatId = `-${Date.now()}${Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0")}`;
      const lat = -29.2367;
      const lon = -51.8698;
      const subscriber: Subscriber = {
        lat: round2(lat),
        lon: round2(lon),
        consent: true,
        last_class: 0,
        last_alert_ts: 0,
      };

      try {
        await store.set(chatId, subscriber);
        expect(await store.get(chatId)).toEqual({
          ...subscriber,
          lat: round2(lat),
          lon: round2(lon),
          consent: true,
        });

        const updated = { ...subscriber, last_class: 2, current_label: "alto" };
        await store.set(chatId, updated);
        expect(await store.get(chatId)).toEqual(updated);

        await store.delete(chatId);
        expect(await store.get(chatId)).toBeNull();
      } finally {
        await store.delete(chatId);
      }
    },
    45_000
  );
});
