import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";

const dir = mkdtempSync(path.join(os.tmpdir(), "nodeos-bridge-"));
const tokenFile = path.join(dir, "app-token");
const keyFile = path.join(dir, "twenty-api-key");
const SECRET = "test-token-secret";
const TWENTY_KEY = "twenty-key";
writeFileSync(tokenFile, SECRET + "\n", { mode: 0o600 });
writeFileSync(keyFile, TWENTY_KEY + "\n", { mode: 0o600 });

process.env.NODEOS_APP_TOKEN_FILE = tokenFile;
process.env.NODEOS_TWENTY_KEY_FILE = keyFile;

type Hit = { method: string | undefined; url: string | undefined; auth: string | undefined; body: string };
const twentyHits: Hit[] = [];
const twenty = http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks).toString("utf8");
  twentyHits.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
  const id = (req.url ?? "").split("/").filter(Boolean).pop();
  if (id === "fail") {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "db down" }));
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end("{}");
});

let bridge: typeof import("./appbridge.js");
let bridgePort = 0;
let bridgeServer: http.Server;

function sign(ts: string, body: string): string {
  return createHmac("sha256", SECRET).update(`${ts}:${body}`).digest("hex");
}

function post(pathName: string, body: string, headers: Record<string, string>): Promise<{ status: number; json: { ok?: boolean; error?: string } }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1",
      port: bridgePort,
      path: pathName,
      method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body), ...headers },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c as Buffer));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode ?? 0, json: text ? JSON.parse(text) as { ok?: boolean; error?: string } : {} });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

before(async () => {
  await new Promise<void>((resolve) => twenty.listen(0, "127.0.0.1", () => resolve()));
  process.env.NODEOS_TWENTY_URL = `http://127.0.0.1:${(twenty.address() as AddressInfo).port}`;
  bridge = await import("./appbridge.js");
  bridgeServer = http.createServer((req, res) => { void bridge.handleBridge(req, res); });
  await new Promise<void>((resolve) => bridgeServer.listen(0, "127.0.0.1", () => resolve()));
  bridgePort = (bridgeServer.address() as AddressInfo).port;
});

after(async () => {
  await new Promise<void>((resolve, reject) => twenty.close((err) => (err ? reject(err) : resolve())));
  if (bridgeServer) await new Promise<void>((resolve, reject) => bridgeServer.close((err) => (err ? reject(err) : resolve())));
});

test("Twenty webhook HMAC is verified against the raw body", async () => {
  const raw = '{ "z" : 1, "a" : { "b" : 2 } }';
  const stringified = JSON.stringify(JSON.parse(raw));
  assert.notEqual(raw, stringified);
  const ts = String(Date.now());
  const nonce = "nonce-raw-body";
  const headers = {
    "x-twenty-webhook-timestamp": ts,
    "x-twenty-webhook-nonce": nonce,
  };
  const payload = raw;

  const rejected = await post("/api/bridge/twenty-webhook", payload, {
    ...headers,
    "x-twenty-webhook-signature": sign(ts, stringified),
  });
  assert.equal(rejected.status, 401);
  assert.equal(rejected.json.error, "bad signature");

  const accepted = await post("/api/bridge/twenty-webhook", payload, {
    ...headers,
    "x-twenty-webhook-signature": sign(ts, raw),
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.json.ok, true);

  const replay = await post("/api/bridge/twenty-webhook", payload, {
    ...headers,
    "x-twenty-webhook-signature": sign(ts, raw),
  });
  assert.equal(replay.status, 401);

  const badJson = await post("/api/bridge/twenty-webhook", "{not json", {
    "x-twenty-webhook-timestamp": ts,
    "x-twenty-webhook-nonce": "nonce-bad-json",
    "x-twenty-webhook-signature": sign(ts, "{not json"),
  });
  assert.equal(badJson.status, 400);
});

test("twentyPatchTask surfaces a failed writeback and accepts a real one", async () => {
  const logs: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map((a) => String(a)).join(" "));
  };
  try {
    process.env.NODEOS_TWENTY_KEY_FILE = path.join(dir, "missing-key");
    await assert.rejects(() => bridge.twentyPatchTask("missing", { status: "DONE" }), /API key unreadable/);

    process.env.NODEOS_TWENTY_KEY_FILE = keyFile;
    await assert.rejects(() => bridge.twentyPatchTask("fail", { status: "DONE" }), /HTTP 500/);
    assert.match(logs.join("\n"), /Twenty writeback failed for task fail: HTTP 500/);
    assert.match(logs.join("\n"), /db down/);
    assert.equal(logs.some((l) => l.includes(TWENTY_KEY)), false);

    twentyHits.length = 0;
    await bridge.twentyPatchTask("ok", { status: "IN_PROGRESS" });
    assert.equal(twentyHits.length, 1);
    assert.equal(twentyHits[0].method, "PATCH");
    assert.equal(twentyHits[0].url, "/rest/tasks/ok");
    assert.equal(twentyHits[0].auth, `Bearer ${TWENTY_KEY}`);
    assert.deepEqual(JSON.parse(twentyHits[0].body), { status: "IN_PROGRESS" });
    assert.equal(logs.some((l) => l.includes("task ok")), false);
  } finally {
    console.error = orig;
    process.env.NODEOS_TWENTY_KEY_FILE = keyFile;
  }
});
