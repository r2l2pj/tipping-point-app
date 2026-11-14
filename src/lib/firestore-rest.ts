// Minimal Firestore REST client over a service account — no SDK, node:crypto
// only. Mints OAuth access tokens via a JWT-bearer grant (RS256) and runs
// get / PATCH / delete on documents in the (default) database.
import { createSign } from "node:crypto";

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
}

type FetchImpl = typeof fetch;

const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const JWT_BEARER_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";

const parseSa = (sa: ServiceAccount | string): ServiceAccount =>
  typeof sa === "string" ? (JSON.parse(sa) as ServiceAccount) : sa;

const b64u = (data: string | object) =>
  Buffer.from(typeof data === "string" ? data : JSON.stringify(data)).toString(
    "base64url"
  );

// Cached per client_email until 60s before expiry.
const tokenCache = new Map<string, { token: string; exp: number }>();

export async function serviceAccountToken(
  saJson: ServiceAccount | string,
  scope: string = DATASTORE_SCOPE,
  fetchImpl: FetchImpl = fetch
): Promise<string> {
  const sa = parseSa(saJson);
  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(sa.client_email);
  if (cached && now < cached.exp) return cached.token;

  const aud = sa.token_uri || DEFAULT_TOKEN_URI;
  const unsigned = `${b64u({ alg: "RS256", typ: "JWT" })}.${b64u({
    iss: sa.client_email,
    scope,
    aud,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(sa.private_key, "base64url");
  const assertion = `${unsigned}.${signature}`;

  const res = await fetchImpl(aud, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent(JWT_BEARER_GRANT)}&assertion=${assertion}`,
  });
  if (!res.ok) throw new Error(`service account token: HTTP ${res.status}`);
  const body = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };
  tokenCache.set(sa.client_email, {
    token: body.access_token,
    exp: now + (body.expires_in ?? 3600) - 60,
  });
  return body.access_token;
}

const docUrl = (sa: ServiceAccount, name: string) =>
  `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/${name}`;

// Firestore value codec — covers the scalar fields of a Subscriber:
// integerValue when Number.isInteger else doubleValue, booleanValue,
// stringValue. Non-scalar/undefined fields are dropped on write.
export type FsValue =
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { stringValue: string };

export function toFsFields(
  doc: Record<string, unknown>
): Record<string, FsValue> {
  const fields: Record<string, FsValue> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (typeof value === "number") {
      fields[key] = Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else if (typeof value === "string") {
      fields[key] = { stringValue: value };
    }
  }
  return fields;
}

export function fromFsFields(
  fields: Record<string, FsValue>
): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = {};
  for (const [key, v] of Object.entries(fields)) {
    if ("integerValue" in v) out[key] = Number(v.integerValue);
    else if ("doubleValue" in v) out[key] = v.doubleValue;
    else if ("booleanValue" in v) out[key] = v.booleanValue;
    else if ("stringValue" in v) out[key] = v.stringValue;
  }
  return out;
}

async function authed(saJson: ServiceAccount | string, fetchImpl: FetchImpl) {
  const sa = parseSa(saJson);
  const token = await serviceAccountToken(sa, DATASTORE_SCOPE, fetchImpl);
  return { sa, headers: { authorization: `Bearer ${token}` } };
}

export async function getDocument(
  saJson: ServiceAccount | string,
  name: string,
  fetchImpl: FetchImpl = fetch
): Promise<Record<string, number | string | boolean> | null> {
  const { sa, headers } = await authed(saJson, fetchImpl);
  const res = await fetchImpl(docUrl(sa, name), { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`firestore get ${name}: HTTP ${res.status}`);
  const doc = (await res.json()) as { fields?: Record<string, FsValue> };
  return doc.fields ? fromFsFields(doc.fields) : null;
}

export async function setDocument(
  saJson: ServiceAccount | string,
  name: string,
  doc: Record<string, unknown>,
  fetchImpl: FetchImpl = fetch
): Promise<void> {
  const { sa, headers } = await authed(saJson, fetchImpl);
  const res = await fetchImpl(docUrl(sa, name), {
    method: "PATCH",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ fields: toFsFields(doc) }),
  });
  if (!res.ok) throw new Error(`firestore set ${name}: HTTP ${res.status}`);
}

export async function deleteDocument(
  saJson: ServiceAccount | string,
  name: string,
  fetchImpl: FetchImpl = fetch
): Promise<void> {
  const { sa, headers } = await authed(saJson, fetchImpl);
  const res = await fetchImpl(docUrl(sa, name), {
    method: "DELETE",
    headers,
  });
  if (!res.ok && res.status !== 404)
    throw new Error(`firestore delete ${name}: HTTP ${res.status}`);
}
