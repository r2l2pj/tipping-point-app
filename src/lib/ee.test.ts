// @ts-expect-error -- bun:test resolves under `bun test`; bun-types isn't a
// dependency so tsc can't see its types.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Imported lazily via loadEe() — ee-tiles.test.ts registers a registry-wide
// mock.module("./ee") stub that leaks into this file's imports; a
// query-suffixed specifier bypasses the mock registry and loads the real
// module.
const loadEe = () =>
  // Non-literal specifier so tsc doesn't resolve (and fail on) the query.
  import("./ee" + "?real") as Promise<typeof import("./ee")>;

const SA_ENVS = [
  "GCP_SA_KEY",
  "GEE_SERVICE_ACCOUNT_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
] as const;

const saved = new Map<string, string | undefined>();
let dir: string | null = null;

function setEnv(k: string, v: string | undefined) {
  if (v === undefined) delete process.env[k];
  else process.env[k] = v;
}

async function fixtureKey(json = true): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), "ee-test-"));
  const path = join(dir, "sa-key.json");
  await writeFile(
    path,
    json ? JSON.stringify({ client_email: "x@y", private_key: "---" }) : "not json"
  );
  return path;
}

// Other suites leak these vars (e.g. GCP_SA_KEY="{}" left set); clear them
// per-test so each case starts from a known state.
beforeEach(() => {
  for (const k of SA_ENVS) delete process.env[k];
});

afterEach(async () => {
  for (const k of SA_ENVS) setEnv(k, saved.get(k));
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = null;
  }
});

// Snapshot env once so afterEach can restore what the developer had set.
for (const k of SA_ENVS) saved.set(k, process.env[k]);

describe("credentialEnv", () => {
  test("prefers GCP_SA_KEY, then GEE_SERVICE_ACCOUNT_KEY, then GAC", async () => {
    const { credentialEnv } = await loadEe();
    const path = "/some/path.json";
    setEnv("GOOGLE_APPLICATION_CREDENTIALS", path);
    expect(credentialEnv()).toBe("GOOGLE_APPLICATION_CREDENTIALS");
    setEnv("GEE_SERVICE_ACCOUNT_KEY", "{}");
    expect(credentialEnv()).toBe("GEE_SERVICE_ACCOUNT_KEY");
    setEnv("GCP_SA_KEY", "{}");
    expect(credentialEnv()).toBe("GCP_SA_KEY");
  });

  test("null when nothing is set", async () => {
    const { credentialEnv } = await loadEe();
    expect(credentialEnv()).toBeNull();
  });
});

describe("loadServiceAccount", () => {
  test("picks GCP_SA_KEY over the GAC path", async () => {
    const path = await fixtureKey();
    setEnv("GOOGLE_APPLICATION_CREDENTIALS", path);
    setEnv("GCP_SA_KEY", JSON.stringify({ client_email: "a@b" }));
    const { loadServiceAccount } = await loadEe();
    const res = await loadServiceAccount();
    expect(res.env).toBe("GCP_SA_KEY");
    expect(res.privateKey).toEqual({ client_email: "a@b" });
  });

  test("picks GEE_SERVICE_ACCOUNT_KEY when GCP_SA_KEY is absent", async () => {
    const path = await fixtureKey();
    setEnv("GOOGLE_APPLICATION_CREDENTIALS", path);
    setEnv("GEE_SERVICE_ACCOUNT_KEY", JSON.stringify({ client_email: "c@d" }));
    const { loadServiceAccount } = await loadEe();
    const res = await loadServiceAccount();
    expect(res.env).toBe("GEE_SERVICE_ACCOUNT_KEY");
    expect(res.privateKey).toEqual({ client_email: "c@d" });
  });

  test("reads and parses the key file at the GAC path", async () => {
    const path = await fixtureKey();
    setEnv("GOOGLE_APPLICATION_CREDENTIALS", path);
    const { loadServiceAccount } = await loadEe();
    const res = await loadServiceAccount();
    expect(res.env).toBe("GOOGLE_APPLICATION_CREDENTIALS");
    expect(res.privateKey).toEqual({
      client_email: "x@y",
      private_key: "---",
    });
  });

  test("missing key file -> error names the env, not the path", async () => {
    setEnv("GOOGLE_APPLICATION_CREDENTIALS", "/nonexistent/dir/key.json");
    const { loadServiceAccount } = await loadEe();
    const err = await loadServiceAccount().then(
      () => null,
      (e: unknown) => e as Error
    );
    expect(err?.message).toContain("GOOGLE_APPLICATION_CREDENTIALS");
    expect(err?.message).not.toContain("/nonexistent");
  });

  test("bad JSON in key file -> error names the env, not contents", async () => {
    const path = await fixtureKey(false);
    setEnv("GOOGLE_APPLICATION_CREDENTIALS", path);
    const { loadServiceAccount } = await loadEe();
    const err = await loadServiceAccount().then(
      () => null,
      (e: unknown) => e as Error
    );
    expect(err?.message).toContain("GOOGLE_APPLICATION_CREDENTIALS");
    expect(err?.message).not.toContain("not json");
    expect(err?.message).not.toContain(path);
  });

  test("bad inline JSON -> error names the env, not contents", async () => {
    setEnv("GCP_SA_KEY", "secret-not-json");
    const { loadServiceAccount } = await loadEe();
    const err = await loadServiceAccount().then(
      () => null,
      (e: unknown) => e as Error
    );
    expect(err?.message).toContain("GCP_SA_KEY");
    expect(err?.message).not.toContain("secret-not-json");
  });

  test("nothing set -> error listing all three envs", async () => {
    const { loadServiceAccount } = await loadEe();
    const err = await loadServiceAccount().then(
      () => null,
      (e: unknown) => e as Error
    );
    expect(err?.message).toContain("GCP_SA_KEY");
    expect(err?.message).toContain("GEE_SERVICE_ACCOUNT_KEY");
    expect(err?.message).toContain("GOOGLE_APPLICATION_CREDENTIALS");
  });
});
