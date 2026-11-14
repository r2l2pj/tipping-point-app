import type { Subscriber, SubscriberStore } from "./store";

type Row = Record<string, unknown>;

export class NeonStore implements SubscriberStore {
  private endpoint: string;

  constructor(private databaseUrl: string, private fetchImpl = fetch) {
    let url: URL;
    try {
      url = new URL(databaseUrl);
    } catch {
      throw new Error("neon store: 0 invalid DATABASE_URL");
    }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2) {
      throw new Error("neon store: 0 invalid DATABASE_URL");
    }
    this.endpoint = `https://${url.hostname}/sql`;
  }

  private async query(query: string, params: unknown[]): Promise<Row[]> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Neon-Connection-String": this.databaseUrl,
        },
        body: JSON.stringify({ query, params }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new Error("neon store: 0 request failed");
    }
    if (!res.ok) throw new Error(`neon store: ${res.status} query failed`);
    let body: { rows?: Row[] } | null;
    try {
      body = await res.json();
    } catch {
      throw new Error(`neon store: ${res.status} invalid response`);
    }
    if (!Array.isArray(body?.rows)) {
      throw new Error(`neon store: ${res.status} missing rows`);
    }
    return body.rows;
  }

  async get(chatId: number | string): Promise<Subscriber | null> {
    const [row] = await this.query(
      "SELECT lat,lon,consent,last_class,last_alert_ts,current_label,data_date FROM subscribers WHERE chat_id = $1",
      [String(chatId)]
    );
    if (!row) return null;
    return {
      lat: Number(row.lat ?? 0),
      lon: Number(row.lon ?? 0),
      consent: row.consent === true || row.consent === "true" || row.consent === "t",
      last_class: Number(row.last_class ?? 0),
      last_alert_ts: row.last_alert_ts == null ? 0 : Date.parse(String(row.last_alert_ts)),
      ...(row.current_label == null ? {} : { current_label: String(row.current_label) }),
      ...(row.data_date == null ? {} : { data_date: String(row.data_date) }),
    };
  }

  async set(chatId: number | string, sub: Subscriber): Promise<void> {
    await this.query(
      "INSERT INTO subscribers (chat_id,lat,lon,consent,last_class,last_alert_ts,current_label,data_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (chat_id) DO UPDATE SET lat=EXCLUDED.lat,lon=EXCLUDED.lon,consent=EXCLUDED.consent,last_class=EXCLUDED.last_class,last_alert_ts=EXCLUDED.last_alert_ts,current_label=EXCLUDED.current_label,data_date=EXCLUDED.data_date",
      [String(chatId), sub.lat, sub.lon, sub.consent, sub.last_class, new Date(sub.last_alert_ts).toISOString(), sub.current_label ?? null, sub.data_date ?? null]
    );
  }

  async delete(chatId: number | string): Promise<void> {
    await this.query("DELETE FROM subscribers WHERE chat_id = $1", [String(chatId)]);
  }
}
