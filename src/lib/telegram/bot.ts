// Pure handler for the Telegram alert bot — all PT-BR copy lives here.
// LGPD rules baked in: always "sua região" (never "sua casa"), coordinates
// rounded to 2 decimals (~1 km), /parar wipes the record.
import type { SubscriberStore } from "./store";

export const FOOTER = "Siga as orientações da Defesa Civil. SMS 40199.";

export const TERMS =
  "Olá! O Tipping Point usa dados da NASA para estimar o risco de deslizamento e enchente na sua região. " +
  "Para receber avisos, compartilhe sua localização no botão abaixo. " +
  "Guardamos só uma posição aproximada (cerca de 1 km) e você apaga tudo com /parar. " +
  "Os avisos são informativos. " +
  FOOTER;

const LOCATION_KEYBOARD = {
  keyboard: [[{ text: "Compartilhar minha localização", request_location: true }]],
  one_time_keyboard: true,
  resize_keyboard: true,
};

export interface TelegramUpdate {
  message?: {
    chat?: { id?: number };
    text?: string;
    location?: { latitude?: number; longitude?: number };
  };
}

// Replay steps per city — mirrors public/data/**/simular.json.
export type Simular = Record<string, { date?: string; label?: string }[]>;

export interface BotDeps {
  send(chatId: number, text: string, replyMarkup?: unknown): Promise<void>;
  store: SubscriberStore;
  fetchSimular(): Promise<Simular>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function handleUpdate(
  update: TelegramUpdate,
  deps: BotDeps
): Promise<void> {
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  if (!msg || chatId == null) return;

  const loc = msg.location;
  if (loc?.latitude != null && loc?.longitude != null) {
    await deps.store.set(chatId, {
      lat: round2(loc.latitude),
      lon: round2(loc.longitude),
      consent: true,
      last_class: 0,
      last_alert_ts: 0,
    });
    await deps.send(
      chatId,
      "Cadastro feito. Você vai receber um aviso quando o risco da sua região subir. Use /status para ver o risco agora."
    );
    return;
  }

  const text = msg.text ?? "";
  const appUrl = process.env.APP_URL;

  if (text.startsWith("/start")) {
    await deps.send(chatId, TERMS, LOCATION_KEYBOARD);
  } else if (text.startsWith("/status")) {
    const sub = await deps.store.get(chatId);
    if (!sub) {
      await deps.send(
        chatId,
        "Você ainda não cadastrou uma localização. Use /start."
      );
    } else {
      await deps.send(
        chatId,
        `Risco agora na sua região: ${sub.current_label ?? "sem dados"}. Dados de ${sub.data_date ?? "-"}.\n${FOOTER}` +
          (appUrl ? `\nMapa: ${appUrl}` : "")
      );
    }
  } else if (text.startsWith("/simular")) {
    let sim: Simular;
    try {
      sim = await deps.fetchSimular();
    } catch {
      await deps.send(chatId, "Simulação indisponível no momento.");
      return;
    }
    await deps.send(
      chatId,
      "Simulação: os avisos que o Tipping Point teria enviado para Encantado (RS) em 2024."
    );
    for (const step of sim["Encantado"] ?? []) {
      await deps.send(chatId, `${step.date}: risco ${step.label}`);
    }
    if (appUrl)
      await deps.send(chatId, `Veja o replay completo no mapa: ${appUrl}`);
  } else if (text.startsWith("/parar")) {
    await deps.store.delete(chatId);
    await deps.send(
      chatId,
      "Seus dados foram apagados. Volte quando quiser com /start."
    );
  }
}
