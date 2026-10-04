import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Creds live under CONFIG_DIR (XDG_CONFIG_HOME/nodeos). Point that at a scratch
// directory holding a paired, account-linked computer before the modules load.
const home = await mkdtemp(path.join(os.tmpdir(), "boxes-cloud-test-"));
process.env.XDG_CONFIG_HOME = home;
process.env.NEXTGENT_PAPERCLIP_URL = "http://paperclip.invalid";
process.env.NEXTGENT_GCR_API_URL = "http://gcr.invalid";
await mkdir(path.join(home, "nodeos"), { recursive: true });
await writeFile(path.join(home, "nodeos", "nextgent.json"), JSON.stringify({ nodeToken: "node-token", account: { key: "board-key", companyId: "company-1" } }));

const { businessToken } = await import("./cloud.js");

test("a business-token request that fails rejects the caller and nothing else (no unhandled rejection)", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: "token service down" }), { status: 500, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  try {
    await assert.rejects(businessToken(), /token service down/);
    // Give any orphaned promise chain a turn to surface.
    await new Promise((r) => setTimeout(r, 20));
  } finally {
    globalThis.fetch = realFetch;
    process.off("unhandledRejection", onUnhandled);
  }
  assert.deepEqual(unhandled, []);
});

test("after a failure the next call tries again instead of reusing the failed request", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ token: "biz", expiresAt: new Date(Date.now() + 600_000).toISOString() }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    assert.equal(await businessToken(), "biz");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
