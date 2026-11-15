import { mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { Subscriber, SubscriberStore } from "./store";

type Value = string | number | null;
type Row = Record<string, unknown>;
type Database = {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: Value[]): unknown;
    get(...params: Value[]): Row | null | undefined;
  };
};

export class SqliteStore implements SubscriberStore {
  private database: Promise<Database> | null = null;

  constructor(private filename: string) {
    this.filename = filename.replace(/^sqlite:/, "");
  }

  private db(): Promise<Database> {
    return this.database ??= this.initialize();
  }

  private async initialize(): Promise<Database> {
    if (this.filename !== ":memory:") {
      await mkdir(path.dirname(this.filename), { recursive: true });
    }
    const require = createRequire(path.join(process.cwd(), "package.json"));
    const { DatabaseSync } = require("node:sqlite") as {
      DatabaseSync: new (filename: string) => Database;
    };
    const db = new DatabaseSync(this.filename);
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    db.exec(await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8"));
    return db;
  }

  async open(): Promise<void> {
    await this.db();
  }

  async get(chatId: number | string): Promise<Subscriber | null> {
    const db = await this.db();
    const row = db.prepare("SELECT lat,lon,consent,last_class,last_alert_ts,current_label,data_date FROM subscribers WHERE chat_id = ?").get(String(chatId));
    if (!row) return null;
    return {
      lat: Number(row.lat ?? 0),
      lon: Number(row.lon ?? 0),
      consent: Boolean(row.consent),
      last_class: Number(row.last_class ?? 0),
      last_alert_ts: row.last_alert_ts == null ? 0 : Date.parse(String(row.last_alert_ts)),
      ...(row.current_label == null ? {} : { current_label: String(row.current_label) }),
      ...(row.data_date == null ? {} : { data_date: String(row.data_date) }),
    };
  }

  async set(chatId: number | string, sub: Subscriber): Promise<void> {
    const db = await this.db();
    db.prepare("INSERT INTO subscribers (chat_id,lat,lon,consent,last_class,last_alert_ts,current_label,data_date) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (chat_id) DO UPDATE SET lat=EXCLUDED.lat,lon=EXCLUDED.lon,consent=EXCLUDED.consent,last_class=EXCLUDED.last_class,last_alert_ts=EXCLUDED.last_alert_ts,current_label=EXCLUDED.current_label,data_date=EXCLUDED.data_date").run(
      String(chatId), sub.lat, sub.lon, Number(sub.consent), sub.last_class,
      new Date(sub.last_alert_ts).toISOString(), sub.current_label ?? null, sub.data_date ?? null
    );
  }

  async delete(chatId: number | string): Promise<void> {
    const db = await this.db();
    db.prepare("DELETE FROM subscribers WHERE chat_id = ?").run(String(chatId));
  }
}
