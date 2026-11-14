// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { FOOTER, handleUpdate, TERMS, type BotDeps, type Simular } from "./bot";
import { MemoryStore } from "./store";

const CHAT = 4242;
const savedAppUrl = process.env.APP_URL;

type Sent = { chatId: number; text: string; markup?: unknown };

function makeDeps(opts: { sim?: Simular; simError?: boolean } = {}) {
  const sent: Sent[] = [];
  const store = new MemoryStore();
  const deps: BotDeps = {
    send: async (chatId, text, replyMarkup) => {
      sent.push({ chatId, text, markup: replyMarkup });
    },
    store,
    fetchSimular: async () => {
      if (opts.simError) throw new Error("no simular");
      return opts.sim ?? {};
    },
  };
  return { deps, sent, store };
}

const text = (t: string) => ({ message: { chat: { id: CHAT }, text: t } });

beforeEach(() => {
  delete process.env.APP_URL;
});

afterEach(() => {
  if (savedAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = savedAppUrl;
});

describe("handleUpdate", () => {
  test("ignores updates without a chat id", async () => {
    const { deps, sent } = makeDeps();
    await handleUpdate({}, deps);
    await handleUpdate({ message: {} }, deps);
    await handleUpdate({ message: { text: "/start" } }, deps);
    expect(sent).toHaveLength(0);
  });

  test("/start sends the terms with a location-request keyboard", async () => {
    const { deps, sent } = makeDeps();
    await handleUpdate(text("/start"), deps);

    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe(CHAT);
    expect(sent[0].text).toBe(TERMS);
    expect(sent[0].text).toContain("sua região");
    expect(sent[0].text).toContain("SMS 40199");
    const kb = sent[0].markup as {
      keyboard: { text: string; request_location?: boolean }[][];
      one_time_keyboard: boolean;
      resize_keyboard: boolean;
    };
    expect(kb.keyboard[0][0].request_location).toBe(true);
    expect(kb.one_time_keyboard).toBe(true);
    expect(kb.resize_keyboard).toBe(true);
  });

  test("location registers rounded coords with consent", async () => {
    const { deps, sent, store } = makeDeps();
    await handleUpdate(
      {
        message: {
          chat: { id: CHAT },
          location: { latitude: -29.2367, longitude: -51.8698 },
        },
      },
      deps
    );

    expect(await store.get(CHAT)).toEqual({
      lat: -29.24,
      lon: -51.87,
      consent: true,
      last_class: 0,
      last_alert_ts: 0,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("Cadastro feito");
    expect(sent[0].text).toContain("sua região");
    for (const s of sent) expect(s.text.endsWith(FOOTER)).toBe(true);
  });

  test("/status without registration points to /start", async () => {
    const { deps, sent } = makeDeps();
    await handleUpdate(text("/status"), deps);
    expect(sent[0].text).toBe(
      `Você ainda não cadastrou uma localização. Use /start.\n${FOOTER}`
    );
    for (const s of sent) expect(s.text.endsWith(FOOTER)).toBe(true);
  });

  test("/status reports label, data date and the footer", async () => {
    const { deps, sent, store } = makeDeps();
    await store.set(CHAT, {
      lat: -29.24,
      lon: -51.87,
      consent: true,
      last_class: 2,
      last_alert_ts: 0,
      current_label: "alto",
      data_date: "2024-05-02",
    });
    await handleUpdate(text("/status"), deps);
    expect(sent[0].text).toBe(
      `Risco agora na sua região: alto. Dados de 2024-05-02.\n${FOOTER}`
    );
    expect(sent[0].text).toContain("SMS 40199");
    for (const s of sent) expect(s.text.endsWith(FOOTER)).toBe(true);
  });

  test("/status falls back to 'sem dados' and appends Mapa when APP_URL set", async () => {
    const { deps, sent, store } = makeDeps();
    await store.set(CHAT, {
      lat: -29.24,
      lon: -51.87,
      consent: true,
      last_class: 0,
      last_alert_ts: 0,
    });
    await handleUpdate(text("/status"), deps);
    expect(sent[0].text).toBe(
      `Risco agora na sua região: sem dados. Dados de -.\n${FOOTER}`
    );

    process.env.APP_URL = "https://tp.example";
    sent.length = 0;
    await handleUpdate(text("/status"), deps);
    expect(sent[0].text).toContain("\nMapa: https://tp.example");
    for (const s of sent) expect(s.text.endsWith(FOOTER)).toBe(true);
    // Map link goes before the footer.
    expect(sent[0].text.indexOf("Mapa:")).toBeLessThan(
      sent[0].text.indexOf(FOOTER)
    );
  });

  test("/simular replays intro + ordered steps", async () => {
    const { deps, sent } = makeDeps({
      sim: {
        Encantado: [
          { date: "2024-04-30", label: "moderado" },
          { date: "2024-05-01", label: "alto" },
        ],
      },
    });
    await handleUpdate(text("/simular"), deps);
    expect(sent.map((s) => s.text)).toEqual([
      `Simulação: os avisos que o Tipping Point teria enviado para Encantado (RS) em 2024.\n${FOOTER}`,
      `2024-04-30: risco moderado\n${FOOTER}`,
      `2024-05-01: risco alto\n${FOOTER}`,
    ]);
    for (const s of sent) expect(s.text.endsWith(FOOTER)).toBe(true);
  });

  test("/simular adds the map link when APP_URL is set", async () => {
    process.env.APP_URL = "https://tp.example";
    const { deps, sent } = makeDeps({ sim: { Encantado: [] } });
    await handleUpdate(text("/simular"), deps);
    expect(sent[sent.length - 1].text).toBe(
      `Veja o replay completo no mapa: https://tp.example\n${FOOTER}`
    );
    for (const s of sent) expect(s.text.endsWith(FOOTER)).toBe(true);
  });

  test("/simular degrades cleanly when the source fails", async () => {
    const { deps, sent } = makeDeps({ simError: true });
    await handleUpdate(text("/simular"), deps);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toBe(`Simulação indisponível no momento.\n${FOOTER}`);
    for (const s of sent) expect(s.text.endsWith(FOOTER)).toBe(true);
  });

  test("/parar deletes the subscriber record", async () => {
    const { deps, sent, store } = makeDeps();
    await store.set(CHAT, {
      lat: -29.24,
      lon: -51.87,
      consent: true,
      last_class: 0,
      last_alert_ts: 0,
    });
    await handleUpdate(text("/parar"), deps);
    expect(await store.get(CHAT)).toBeNull();
    expect(sent[0].text).toBe(
      `Seus dados foram apagados. Volte quando quiser com /start.\n${FOOTER}`
    );
    for (const s of sent) expect(s.text.endsWith(FOOTER)).toBe(true);
  });

  test("unrelated text sends nothing", async () => {
    const { deps, sent } = makeDeps();
    await handleUpdate(text("olá, tudo bem?"), deps);
    expect(sent).toHaveLength(0);
  });
});
