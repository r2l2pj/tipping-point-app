// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { describe, expect, test } from "bun:test";
import { createVerify, generateKeyPairSync } from "node:crypto";

import {
  deleteDocument,
  fromFsFields,
  getDocument,
  serviceAccountToken,
  setDocument,
  toFsFields,
  type ServiceAccount,
} from "@/lib/firestore-rest";

// A real (throwaway) RSA key so the JWT can be signature-verified, not just
// shape-checked. No network: every call goes through a fake fetch.
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const sa: ServiceAccount = {
  client_email: "tg-bot@demo.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  project_id: "demo-proj",
};

type Call = { url: string; init?: RequestInit };

function fakeFetch(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { impl, calls };
}

const tokenResponse = () =>
  Response.json({ access_token: "ya29.fake", expires_in: 3600 });

describe("serviceAccountToken", () => {
  test("POSTs a signed JWT-bearer grant and caches per client_email", async () => {
    const { impl, calls } = fakeFetch(tokenResponse);

    const t1 = await serviceAccountToken(sa, undefined, impl);
    const t2 = await serviceAccountToken(sa, undefined, impl);
    expect(t1).toBe("ya29.fake");
    expect(t2).toBe("ya29.fake");
    expect(calls).toHaveLength(1); // second call hits the cache

    const call = calls[0];
    expect(call.url).toBe("https://oauth2.googleapis.com/token");
    expect(call.init?.method).toBe("POST");

    const params = new URLSearchParams(String(call.init?.body));
    expect(params.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer"
    );

    const assertion = params.get("assertion") ?? "";
    const [h, p, sig] = assertion.split(".");
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(header.alg).toBe("RS256");
    expect(payload.iss).toBe(sa.client_email);
    expect(payload.scope).toBe("https://www.googleapis.com/auth/datastore");
    expect(payload.aud).toBe("https://oauth2.googleapis.com/token");
    expect(payload.exp - payload.iat).toBe(3600);

    const valid = createVerify("RSA-SHA256")
      .update(`${h}.${p}`)
      .verify(publicKey, sig, "base64url");
    expect(valid).toBe(true);
  });
});

describe("document REST calls", () => {
  const docUrl =
    "https://firestore.googleapis.com/v1/projects/demo-proj/databases/(default)/documents/subscribers/42";
  // Distinct client_email so the token cache from the previous suite misses.
  const sa2 = { ...sa, client_email: "docs@demo.iam.gserviceaccount.com" };

  function docFetch(body: object, status = 200) {
    return fakeFetch(({ url }) =>
      url.includes("oauth2.googleapis.com")
        ? tokenResponse()
        : new Response(JSON.stringify(body), { status })
    );
  }

  test("getDocument hits the v1 REST URL with a bearer token", async () => {
    const { impl, calls } = docFetch({
      fields: {
        lat: { doubleValue: -29.24 },
        lon: { doubleValue: -51.87 },
        consent: { booleanValue: true },
        last_class: { integerValue: "2" },
        current_label: { stringValue: "alto" },
      },
    });
    const doc = await getDocument(sa2, "subscribers/42", impl);

    const docCall = calls.find((c) => c.url.includes("firestore"));
    expect(docCall?.url).toBe(docUrl);
    expect(docCall?.init?.headers).toEqual({ authorization: "Bearer ya29.fake" });
    expect(doc).toEqual({
      lat: -29.24,
      lon: -51.87,
      consent: true,
      last_class: 2,
      current_label: "alto",
    });
  });

  test("getDocument returns null on 404", async () => {
    const { impl } = docFetch({}, 404);
    expect(await getDocument(sa2, "subscribers/999", impl)).toBeNull();
  });

  test("setDocument PATCHes encoded fields", async () => {
    const { impl, calls } = docFetch({});
    await setDocument(
      sa2,
      "subscribers/42",
      { lat: -29.24, last_class: 2, consent: true, current_label: "alto" },
      impl
    );

    const docCall = calls.find((c) => c.url.includes("firestore"));
    expect(docCall?.init?.method).toBe("PATCH");
    const body = JSON.parse(String(docCall?.init?.body)) as {
      fields: Record<string, unknown>;
    };
    expect(body.fields).toEqual({
      lat: { doubleValue: -29.24 },
      last_class: { integerValue: "2" },
      consent: { booleanValue: true },
      current_label: { stringValue: "alto" },
    });
  });

  test("deleteDocument issues DELETE and tolerates 404", async () => {
    const { impl, calls } = docFetch({}, 404);
    await deleteDocument(sa2, "subscribers/42", impl);
    const docCall = calls.find((c) => c.url.includes("firestore"));
    expect(docCall?.init?.method).toBe("DELETE");
  });
});

describe("field codec", () => {
  test("round-trips subscriber scalars", () => {
    const fields = toFsFields({
      lat: -29.24,
      last_class: 0,
      consent: true,
      current_label: "alto",
      data_date: undefined, // dropped
    });
    expect(fromFsFields(fields)).toEqual({
      lat: -29.24,
      last_class: 0,
      consent: true,
      current_label: "alto",
    });
  });
});
