// Subscriber records for the Telegram alert channel.
// LGPD: we keep only an approximate position (rounded to ~1 km) plus alert
// bookkeeping; /parar wipes the whole record.

export interface Subscriber {
  lat: number;
  lon: number;
  consent: boolean;
  last_class: number;
  last_alert_ts: number;
  current_label?: string;
  data_date?: string;
}

export interface SubscriberStore {
  get(chatId: number | string): Promise<Subscriber | null>;
  set(chatId: number | string, sub: Subscriber): Promise<void>;
  delete(chatId: number | string): Promise<void>;
}

// Process-local fallback store; resets on cold start. Durable backends are
// NeonStore/SqliteStore, chosen by DATABASE_URL in deps.ts.
export class MemoryStore implements SubscriberStore {
  private subs = new Map<string, Subscriber>();

  async get(chatId: number | string): Promise<Subscriber | null> {
    return this.subs.get(String(chatId)) ?? null;
  }

  async set(chatId: number | string, sub: Subscriber): Promise<void> {
    this.subs.set(String(chatId), sub);
  }

  async delete(chatId: number | string): Promise<void> {
    this.subs.delete(String(chatId));
  }
}

const memoryStore = new MemoryStore();
export default memoryStore;
