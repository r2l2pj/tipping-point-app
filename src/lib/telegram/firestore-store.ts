// Durable SubscriberStore on Firestore — collection `subscribers`, one
// document per chat id — via the dependency-free REST client.
import {
  deleteDocument,
  getDocument,
  setDocument,
  type ServiceAccount,
} from "@/lib/firestore-rest";
import type { Subscriber, SubscriberStore } from "./store";

export class FirestoreStore implements SubscriberStore {
  constructor(private sa: ServiceAccount) {}

  private doc(chatId: number | string) {
    return `subscribers/${chatId}`;
  }

  async get(chatId: number | string): Promise<Subscriber | null> {
    return (await getDocument(this.sa, this.doc(chatId))) as Subscriber | null;
  }

  async set(chatId: number | string, sub: Subscriber): Promise<void> {
    await setDocument(this.sa, this.doc(chatId), { ...sub });
  }

  async delete(chatId: number | string): Promise<void> {
    await deleteDocument(this.sa, this.doc(chatId));
  }
}
