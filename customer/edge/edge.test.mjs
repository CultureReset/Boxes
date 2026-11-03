// node --test customer/edge/    (npm run test:edge). No network, no Docker, no credentials.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classify, classifyConnect, parseConnectTarget } from "./policy.mjs";
import { IssueStore } from "./issues.mjs";
import { loadConfig, start, ConfigError, isPrivateAddress } from "./edge.mjs";

const COMPANY = "11111111-2222-4333-8444-55555555abcd";
const OTHER = "99999999-8888-4777-8666-555555555555";
const MINE = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"; // an issue this container created
const THEIRS = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee"; // somebody else's
const known = new Set([MINE]);
const hasIssue = (id) => known.has(id);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "edge-test-"));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// ---- 1. the policy, case by case -----------------------------------------------------

const ALLOW = "allow";
/** [label, method, target, expected: ALLOW or the refusal reason] */
const POLICY_CASES = [
  // allowed
  ["create an issue in this company", "POST", `/api/companies/${COMPANY}/issues`, ALLOW],
  ["list this company's issues", "GET", `/api/companies/${COMPANY}/issues`, ALLOW],
  ["read an issue this container created", "GET", `/api/issues/${MINE}`, ALLOW],
  ["read comments of an issue this container created", "GET", `/api/issues/${MINE}/comments`, ALLOW],

  // another company, another container's issues
  ["create in another company", "POST", `/api/companies/${OTHER}/issues`, "other-company"],
  ["list another company's issues", "GET", `/api/companies/${OTHER}/issues`, "other-company"],
  ["this company's id in upper case (case trick)", "GET", `/api/companies/${COMPANY.toUpperCase()}/issues`, "other-company"],
  ["read an issue someone else created", "GET", `/api/issues/${THEIRS}`, "issue-not-created-here"],
  ["read comments of an issue someone else created", "GET", `/api/issues/${THEIRS}/comments`, "issue-not-created-here"],
  ["our issue id in upper case (case trick)", "GET", `/api/issues/${MINE.toUpperCase()}`, "issue-not-created-here"],
  ["a company id used where an issue id goes", "GET", `/api/issues/${COMPANY}`, "issue-not-created-here"],

  // methods
  ["DELETE an issue", "DELETE", `/api/issues/${MINE}`, "method-not-allowed"],
  ["PUT on the issues collection", "PUT", `/api/companies/${COMPANY}/issues`, "method-not-allowed"],
  ["PATCH an issue", "PATCH", `/api/issues/${MINE}`, "method-not-allowed"],
  ["HEAD", "HEAD", `/api/companies/${COMPANY}/issues`, "method-not-allowed"],
  ["OPTIONS", "OPTIONS", `/api/companies/${COMPANY}/issues`, "method-not-allowed"],
  ["lower-case method", "get", `/api/companies/${COMPANY}/issues`, "method-not-allowed"],
  ["POST to read an issue", "POST", `/api/issues/${MINE}`, "method-not-allowed-for-route"],
  ["POST to comments", "POST", `/api/issues/${MINE}/comments`, "method-not-allowed-for-route"],

  // case tricks on the fixed words
  ["upper-case /API", "GET", `/API/companies/${COMPANY}/issues`, "out-of-scope"],
  ["upper-case COMPANIES", "GET", `/api/COMPANIES/${COMPANY}/issues`, "out-of-scope"],
  ["capitalised Issues", "GET", `/api/Issues/${MINE}`, "out-of-scope"],
  ["upper-case COMMENTS", "GET", `/api/issues/${MINE}/COMMENTS`, "out-of-scope"],

  // query and fragment smuggling
  ["query naming another company", "GET", `/api/companies/${COMPANY}/issues?companyId=${OTHER}`, "query-not-allowed"],
  ["empty query", "GET", `/api/companies/${COMPANY}/issues?`, "query-not-allowed"],
  ["query on an issue", "GET", `/api/issues/${MINE}?x=1`, "query-not-allowed"],
  ["fragment hiding the real path", "GET", `/api/companies/${OTHER}/issues#/companies/${COMPANY}/issues`, "fragment-not-allowed"],
  ["fragment after a good path", "GET", `/api/companies/${COMPANY}/issues#x`, "fragment-not-allowed"],
  ["query carrying a second path", "GET", `/api/issues/${MINE}?/../${THEIRS}`, "query-not-allowed"],

  // encoding and traversal
  ["encoded slashes (%2F) around another company", "GET", `/api/companies%2F${OTHER}%2Fissues`, "path-characters-not-allowed"],
  ["encoded slash (%2f) in an issue path", "GET", `/api/issues%2f${THEIRS}`, "path-characters-not-allowed"],
  ["encoded slash and dots after our company", "GET", `/api/companies/${COMPANY}%2f..%2f${OTHER}/issues`, "path-characters-not-allowed"],
  ["encoded dots (%2e%2e)", "GET", `/api/%2e%2e/companies/${OTHER}/issues`, "path-characters-not-allowed"],
  ["double-encoded dots (%252e)", "GET", `/api/issues/%252e%252e/${THEIRS}`, "path-characters-not-allowed"],
  ["encoded letter in a fixed word", "GET", `/api/%69ssues/${MINE}`, "path-characters-not-allowed"],
  ["dot-dot to another company", "GET", `/api/companies/${COMPANY}/../${OTHER}/issues`, "dot-segment"],
  ["dot-dot out of an issue", "GET", `/api/issues/${MINE}/../${THEIRS}`, "dot-segment"],
  ["single dot segment", "GET", `/api/./companies/${COMPANY}/issues`, "dot-segment"],
  ["dot-dot to leave /api", "GET", "/api/../etc/passwd", "dot-segment"],
  ["double slash after /api", "GET", `/api//companies/${COMPANY}/issues`, "empty-path-segment"],
  ["leading double slash", "GET", `//api/companies/${COMPANY}/issues`, "empty-path-segment"],
  ["double slash inside", "GET", `/api/companies/${COMPANY}//issues`, "empty-path-segment"],
  ["trailing slash", "GET", `/api/companies/${COMPANY}/issues/`, "empty-path-segment"],
  ["backslash separators", "GET", `/api/companies\\${OTHER}\\issues`, "path-characters-not-allowed"],
  ["path parameter with semicolon", "GET", `/api/companies/${COMPANY};x=${OTHER}/issues`, "path-characters-not-allowed"],
  ["NUL byte", "GET", `/api/issues/${MINE}\0`, "path-characters-not-allowed"],
  ["CRLF header injection", "GET", `/api/issues/${MINE}\r\nX-Evil: 1`, "path-characters-not-allowed"],
  ["space in the path", "GET", `/api/issues/${MINE} x`, "path-characters-not-allowed"],
  ["right-to-left override character", "GET", `/api/issues/${MINE}‮`, "path-characters-not-allowed"],
  ["full-width solidus", "GET", `/api/companies／${OTHER}／issues`, "path-characters-not-allowed"],
  ["absolute-form target", "GET", `http://paperclip:3100/api/companies/${COMPANY}/issues`, "path-characters-not-allowed"],

  // anything else on Paperclip
  ["root", "GET", "/", "empty-path-segment"],
  ["/api alone", "GET", "/api", "out-of-scope"],
  ["company without /issues", "GET", `/api/companies/${COMPANY}`, "out-of-scope"],
  ["the companies collection", "GET", "/api/companies", "out-of-scope"],
  ["this company's agents", "GET", `/api/companies/${COMPANY}/agents`, "out-of-scope"],
  ["an issue under the company path", "GET", `/api/companies/${COMPANY}/issues/${MINE}`, "out-of-scope"],
  ["an unlisted sub-resource of our issue", "GET", `/api/issues/${MINE}/checkout`, "out-of-scope"],
  ["extra segment after comments", "GET", `/api/issues/${MINE}/comments/1`, "out-of-scope"],
  ["issues with no id", "GET", "/api/issues", "out-of-scope"],
  ["agents", "GET", "/api/agents", "out-of-scope"],
  ["a path outside /api", "GET", `/companies/${COMPANY}/issues`, "out-of-scope"],
  ["empty target", "GET", "", "bad-target"],
  ["very long target", "GET", `/api/issues/${"a".repeat(2000)}`, "bad-target"],
];

for (const [label, method, target, expected] of POLICY_CASES) {
  test(`policy: ${expected === ALLOW ? "allows" : "denies"} ${label}`, () => {
    const d = classify({ method, target, companyId: COMPANY, hasIssue });
    if (expected === ALLOW) assert.equal(d.allow, true, JSON.stringify(d));
    else assert.deepEqual({ allow: d.allow, reason: d.reason }, { allow: false, reason: expected });
  });
}

test("policy: the table has at least 30 allowed-or-denied cases including traversal and another company", () => {
  assert.ok(POLICY_CASES.length >= 30);
  assert.ok(POLICY_CASES.some((c) => c[2].includes("..")));
  assert.ok(POLICY_CASES.some((c) => c[2].includes(OTHER)));
});

test("policy: an allowed request forwards the exact validated path", () => {
  const d = classify({ method: "GET", target: `/api/issues/${MINE}/comments`, companyId: COMPANY, hasIssue });
  assert.deepEqual(d, { allow: true, route: "comments:get", issueId: MINE, path: `/issues/${MINE}/comments` });
});

// ---- 2. CONNECT policy -----------------------------------------------------------------

const ALLOW_HOSTS = new Set(["api.example.com", "203.0.113.7"]);
const connect = (target) => classifyConnect({ target, allowHosts: ALLOW_HOSTS, ports: [443], paperclipHost: "paperclip.internal" });
for (const [target, expected] of [
  ["api.example.com:443", "allow"],
  ["API.EXAMPLE.COM:443", "allow"],
  ["203.0.113.7:443", "allow"],
  ["api.example.com:80", "port-not-allowed"],
  ["api.example.com:8443", "port-not-allowed"],
  ["evil.example.net:443", "host-not-allowed"],
  ["api.example.com.evil.net:443", "host-not-allowed"],
  ["paperclip.internal:443", "paperclip-only-through-gateway"],
  ["PAPERCLIP.INTERNAL:3100", "paperclip-only-through-gateway"],
  ["127.0.0.1:443", "host-not-allowed"],
  ["api.example.com", "bad-target"],
  ["api.example.com:0", "bad-target"],
  ["api.example.com:99999", "bad-target"],
  ["api.example.com:443:80", "bad-target"],
  ["user@api.example.com:443", "bad-target"],
  ["[::1]:443", "bad-target"],
  ["", "bad-target"],
]) {
  test(`connect: ${expected === "allow" ? "allows" : "denies"} ${JSON.stringify(target)}`, () => {
    const d = connect(target);
    if (expected === "allow") assert.equal(d.allow, true);
    else assert.equal(d.reason, expected);
  });
}
test("connect target parsing lower-cases the host", () => assert.deepEqual(parseConnectTarget("A.B:443"), { host: "a.b", port: 443 }));

test("private-address check covers loopback, LAN, tailnet, link-local and ULA", () => {
  for (const a of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "172.16.0.1", "100.64.0.1", "100.100.1.1", "169.254.1.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) assert.equal(isPrivateAddress(a), true, a);
  for (const a of ["8.8.8.8", "203.0.113.7", "100.63.0.1", "172.32.0.1", "2606:4700::1"]) assert.equal(isPrivateAddress(a), false, a);
});

// ---- 3. the issue-id store ----------------------------------------------------------------

test("store: persists, is bounded (oldest first), ignores bad ids, other companies' files and damaged files", () => {
  const dir = path.join(tmp, "store1");
  const s = new IssueStore({ dir, companyId: COMPANY, max: 3 });
  assert.equal(s.add("not a valid id!"), false);
  assert.equal(s.add("../etc"), false);
  assert.equal(s.add(42), false);
  for (const id of ["i1", "i2", "i3", "i4", "i5"]) assert.equal(s.add(id), true);
  assert.deepEqual([...s.ids], ["i3", "i4", "i5"]);
  assert.equal(s.has("i1"), false);
  assert.deepEqual([...new IssueStore({ dir, companyId: COMPANY, max: 3 }).ids], ["i3", "i4", "i5"], "survives a restart");
  assert.deepEqual([...new IssueStore({ dir, companyId: COMPANY, max: 2 }).ids], ["i4", "i5"], "a smaller limit trims on load");
  assert.equal(new IssueStore({ dir, companyId: OTHER, max: 3 }).size, 0, "ids recorded for another company are not honoured");
  fs.writeFileSync(path.join(dir, "issues.json"), "{ not json");
  assert.equal(new IssueStore({ dir, companyId: COMPANY }).size, 0, "damaged file: nothing is known");
  assert.equal(fs.statSync(path.join(dir, "issues.json")).mode & 0o077, 0, "file is private");
});

test("store: a state directory that cannot be created is an error at start, not a silent no-op", () => {
  const file = path.join(tmp, "a-file");
  fs.writeFileSync(file, "x");
  assert.throws(() => new IssueStore({ dir: path.join(file, "state"), companyId: COMPANY }));
});

// ---- 4. configuration -----------------------------------------------------------------------

const GOOD_ENV = { EDGE_ALLOW: "api.example.com", PAPERCLIP_COMPANY_ID: COMPANY, PAPERCLIP_UPSTREAM_URL: "http://paperclip.internal:3100/api" };

test("config: valid environment, and every problem names a variable without echoing a value", () => {
  const cfg = loadConfig(GOOD_ENV);
  assert.deepEqual([cfg.upstream.hostname, cfg.upstream.port, cfg.upstream.base], ["paperclip.internal", 3100, "/api"]);
  for (const [env, re] of [
    [{ ...GOOD_ENV, EDGE_ALLOW: "" }, /EDGE_ALLOW/],
    [{ ...GOOD_ENV, EDGE_ALLOW: "bad host!,x" }, /EDGE_ALLOW/],
    [{ ...GOOD_ENV, PAPERCLIP_COMPANY_ID: "nope" }, /PAPERCLIP_COMPANY_ID/],
    [{ ...GOOD_ENV, PAPERCLIP_UPSTREAM_URL: "ftp://x" }, /PAPERCLIP_UPSTREAM_URL/],
    [{ ...GOOD_ENV, PAPERCLIP_UPSTREAM_URL: "http://user:pw@x:1/api" }, /PAPERCLIP_UPSTREAM_URL/],
    [{ ...GOOD_ENV, EDGE_MAX_BODY: "0" }, /maxBody/],
  ]) {
    assert.throws(() => loadConfig(env), (e) => e instanceof ConfigError && re.test(e.message) && !/pw|nope|bad host/.test(e.message));
  }
});

// ---- 5. the running edge, against a fake Paperclip -----------------------------------------------

const listen = (server, host = "127.0.0.1") => new Promise((r) => server.listen(0, host, () => r(server.address().port)));

/** A stand-in Paperclip that records what reaches it. */
async function fakePaperclip(behaviour = {}) {
  const seen = [];
  let n = 0;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      seen.push({ method: req.method, url: req.url, headers: req.headers, body });
      if (behaviour.handler) return behaviour.handler(req, res, body);
      res.setHeader("content-type", "application/json");
      if (req.method === "POST") {
        n += 1;
        return res.end(JSON.stringify({ id: `00000000-0000-4000-8000-00000000000${n}`, companyId: COMPANY, status: "todo" }));
      }
      if (/\/comments$/.test(req.url)) return res.end("[]");
      res.end(JSON.stringify({ id: req.url.split("/").pop(), companyId: COMPANY, status: "done" }));
    });
  });
  const port = await listen(server);
  return { seen, port, close: () => new Promise((r) => { server.close(() => r()); server.closeAllConnections?.(); }) };
}

async function withEdge(opts, fn) {
  const pc = await fakePaperclip(opts.paperclip);
  const dir = opts.dir ?? fs.mkdtempSync(path.join(tmp, "state-"));
  const cfg = loadConfig({
    ...GOOD_ENV,
    EDGE_ALLOW: opts.allow ?? "127.0.0.1",
    PAPERCLIP_UPSTREAM_URL: `http://127.0.0.1:${pc.port}/api`,
    EDGE_STATE_DIR: dir,
    EDGE_PROXY_PORT: "0",
    EDGE_GATEWAY_PORT: "0",
    EDGE_FORWARD_PORT: "0",
    EDGE_BIND: "127.0.0.1",
    EDGE_UPSTREAM: `${opts.forwardTo?.host ?? "127.0.0.1"}:${opts.forwardTo?.port ?? 9}`,
    ...(opts.env ?? {}),
  });
  if (opts.connectPorts) cfg.connectPorts = opts.connectPorts;
  const logs = [];
  const edge = await start(cfg, { log: (o) => logs.push(o), lookup: opts.lookup });
  try {
    await fn({ edge, pc, logs, dir, cfg });
  } finally {
    await edge.close();
    await pc.close();
  }
}

function req(port, method, target, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port, method, path: target, headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = JSON.parse(text); } catch { /* not json */ }
        resolve({ status: res.statusCode, text, json, headers: res.headers });
      });
    });
    r.on("error", reject);
    r.end(body);
  });
}
const jsonPost = (port, target, obj, headers = {}) => {
  const body = JSON.stringify(obj);
  return req(port, "POST", target, { body, headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body), ...headers } });
};

test("edge: create, read back, read comments; only that company's paths reach Paperclip; the bearer key passes through", async () => {
  await withEdge({}, async ({ edge, pc }) => {
    const g = edge.ports.gateway;
    const created = await jsonPost(g, `/api/companies/${COMPANY}/issues`, { title: "t" }, { authorization: "Bearer test-key-not-real" });
    assert.equal(created.status, 200);
    const id = created.json.id;
    assert.ok(edge.store.has(id), "the id from the create response was recorded");
    assert.equal((await req(g, "GET", `/api/issues/${id}`)).json.status, "done");
    assert.equal((await req(g, "GET", `/api/issues/${id}/comments`)).status, 200);
    assert.equal(pc.seen.length, 3);
    assert.equal(pc.seen[0].url, `/api/companies/${COMPANY}/issues`);
    assert.equal(pc.seen[0].headers.authorization, "Bearer test-key-not-real");
    assert.equal(pc.seen[0].headers.host, `127.0.0.1:${pc.port}`, "Host is the edge's, not the caller's");
  });
});

test("edge: refused requests never reach Paperclip, and the refusal is 403 JSON", async () => {
  await withEdge({}, async ({ edge, pc }) => {
    const g = edge.ports.gateway;
    for (const [m, t] of [
      ["GET", `/api/companies/${OTHER}/issues`],
      ["POST", `/api/companies/${OTHER}/issues`],
      ["GET", `/api/issues/${THEIRS}`],
      ["GET", `/api/issues/${THEIRS}/comments`],
      ["GET", `/api/companies/${COMPANY}/../${OTHER}/issues`],
      ["GET", `/api/companies%2F${OTHER}%2Fissues`],
      ["GET", `/api/companies/${COMPANY}/issues?x=1`],
      ["DELETE", `/api/companies/${COMPANY}/issues`],
      ["GET", "/api/agents"],
      ["GET", "/"],
    ]) {
      const r = await req(g, m, t, { headers: m === "POST" ? { "content-type": "application/json", "content-length": "2" } : {}, body: m === "POST" ? "{}" : undefined });
      assert.equal(r.status, 403, `${m} ${t}`);
      assert.match(r.headers["content-type"], /application\/json/);
      assert.equal(r.json.error, "forbidden");
      assert.ok(typeof r.json.reason === "string");
    }
    assert.equal(pc.seen.length, 0);
  });
});

test("edge: an issue id from a different company's response is never recorded", async () => {
  await withEdge({ paperclip: { handler: (_q, res) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ id: "zzz", companyId: OTHER })); } } }, async ({ edge }) => {
    const r = await jsonPost(edge.ports.gateway, `/api/companies/${COMPANY}/issues`, {});
    assert.equal(r.status, 502);
    assert.equal(r.json.reason, "upstream-company-mismatch");
    assert.equal(edge.store.size, 0);
  });
});

test("edge: only 200/201 create responses with a plain id are recorded", async () => {
  for (const [status, payload, recorded] of [[500, { id: "abc" }, 0], [200, { id: "../x" }, 0], [200, { nope: 1 }, 0], [201, { id: "abc" }, 1]]) {
    await withEdge({ paperclip: { handler: (_q, res) => { res.statusCode = status; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(payload)); } } }, async ({ edge }) => {
      await jsonPost(edge.ports.gateway, `/api/companies/${COMPANY}/issues`, {});
      assert.equal(edge.store.size, recorded, JSON.stringify([status, payload]));
    });
  }
});

test("edge: ids survive a restart and the store stays bounded", async () => {
  const dir = fs.mkdtempSync(path.join(tmp, "persist-"));
  let first;
  await withEdge({ dir, env: { EDGE_MAX_ISSUES: "3" } }, async ({ edge }) => {
    const ids = [];
    for (let i = 0; i < 5; i += 1) ids.push((await jsonPost(edge.ports.gateway, `/api/companies/${COMPANY}/issues`, {})).json.id);
    first = ids;
    assert.equal((await req(edge.ports.gateway, "GET", `/api/issues/${ids[0]}`)).status, 403, "oldest id was dropped");
    assert.equal((await req(edge.ports.gateway, "GET", `/api/issues/${ids[4]}`)).status, 200);
  });
  await withEdge({ dir, env: { EDGE_MAX_ISSUES: "3" } }, async ({ edge }) => {
    assert.equal((await req(edge.ports.gateway, "GET", `/api/issues/${first[4]}`)).status, 200, "after restart");
    assert.equal((await req(edge.ports.gateway, "GET", `/api/issues/${first[1]}`)).status, 403);
  });
});

test("edge: request body rules (size cap, content type, JSON object, content length, GET without body)", async () => {
  await withEdge({ env: { EDGE_MAX_BODY: "100" } }, async ({ edge, pc }) => {
    const g = edge.ports.gateway;
    const url = `/api/companies/${COMPANY}/issues`;
    const big = JSON.stringify({ title: "x".repeat(200) });
    assert.equal((await req(g, "POST", url, { body: big, headers: { "content-type": "application/json", "content-length": String(big.length) } })).status, 413, "declared too large");
    assert.equal((await req(g, "POST", url, { body: "{}", headers: { "content-type": "text/plain", "content-length": "2" } })).status, 415);
    assert.equal((await req(g, "POST", url, { body: "[]", headers: { "content-type": "application/json", "content-length": "2" } })).status, 400);
    assert.equal((await req(g, "POST", url, { body: "not json", headers: { "content-type": "application/json", "content-length": "8" } })).status, 400);
    assert.equal((await req(g, "POST", url, { body: "{}", headers: { "content-type": "application/json", "transfer-encoding": "chunked" } })).status, 403, "chunked refused");
    assert.equal((await req(g, "GET", url, { body: "{}", headers: { "content-length": "2" } })).status, 403, "GET with a body");
    assert.equal(pc.seen.length, 0);
    assert.equal((await req(g, "POST", url, { body: "{}", headers: { "content-type": "application/json", "content-length": "2" } })).status, 200);
  });
});

test("edge: raw wire tricks (absolute URL in the request line, pipelined second request, tab in the request line) never reach another company", async () => {
  await withEdge({}, async ({ edge, pc }) => {
    const raw = (text) => new Promise((resolve) => {
      const s = net.connect(edge.ports.gateway, "127.0.0.1", () => s.write(text));
      let out = "";
      s.on("data", (d) => (out += d));
      s.on("close", () => resolve(out));
      s.on("error", () => resolve(out));
      setTimeout(() => s.destroy(), 1500);
    });
    const abs = await raw(`GET http://x/api/companies/${OTHER}/issues HTTP/1.1\r\nhost: x\r\n\r\n`);
    assert.match(abs, /^HTTP\/1\.1 403/);
    const tab = await raw(`GET /api/companies/${OTHER}/issues\t HTTP/1.1\r\nhost: x\r\n\r\n`);
    assert.match(tab, /^HTTP\/1\.1 (400|403)/);
    const piped = await raw(`GET /api/companies/${COMPANY}/issues HTTP/1.1\r\nhost: x\r\n\r\nGET /api/companies/${OTHER}/issues HTTP/1.1\r\nhost: x\r\n\r\n`);
    assert.match(piped, /^HTTP\/1\.1 200/);
    assert.equal((piped.match(/HTTP\/1\.1 200/g) ?? []).length + (piped.match(/HTTP\/1\.1 403/g) ?? []).length >= 1, true);
    for (const s of pc.seen) assert.ok(!s.url.includes(OTHER), "nothing for another company reached Paperclip");
  });
});

test("edge: upstream trouble becomes a clean 502/504, never a hang or a redirect", async () => {
  await withEdge({ env: { EDGE_UPSTREAM_TIMEOUT_MS: "200" }, paperclip: { handler: () => { /* never answers */ } } }, async ({ edge }) => {
    const t0 = Date.now();
    const r = await req(edge.ports.gateway, "GET", `/api/companies/${COMPANY}/issues`);
    assert.equal(r.status, 504);
    assert.ok(Date.now() - t0 < 3000);
  });
  await withEdge({ paperclip: { handler: (_q, res) => { res.statusCode = 302; res.setHeader("location", "http://elsewhere/"); res.end(); } } }, async ({ edge }) => {
    const r = await req(edge.ports.gateway, "GET", `/api/companies/${COMPANY}/issues`);
    assert.equal(r.status, 502);
    assert.equal(r.headers.location, undefined);
  });
  await withEdge({ env: { EDGE_MAX_RESPONSE: "1000" }, paperclip: { handler: (_q, res) => res.end("x".repeat(5000)) } }, async ({ edge }) => {
    assert.equal((await req(edge.ports.gateway, "GET", `/api/companies/${COMPANY}/issues`)).status, 502);
  });
});

test("edge: a client that sends headers or a body too slowly is dropped", async () => {
  await withEdge({ env: { EDGE_HEADERS_TIMEOUT_MS: "300", EDGE_REQUEST_TIMEOUT_MS: "600" } }, async ({ edge }) => {
    const closedAfter = (write) => new Promise((resolve) => {
      const t0 = Date.now();
      const s = net.connect(edge.ports.gateway, "127.0.0.1", () => s.write(write));
      s.on("data", () => {});
      s.on("close", () => resolve(Date.now() - t0));
      s.on("error", () => {});
      setTimeout(() => { s.destroy(); resolve(Infinity); }, 4000);
    });
    assert.ok((await closedAfter("GET /api/companies/x/issues HTTP/1.1\r\nhost: x\r\n")) < 3500, "partial headers");
    assert.ok((await closedAfter(`POST /api/companies/${COMPANY}/issues HTTP/1.1\r\nhost: x\r\ncontent-type: application/json\r\ncontent-length: 100\r\n\r\n{"a"`)) < 3500, "partial body");
  });
});

test("edge: the log never contains the Authorization header or request bodies", async () => {
  await withEdge({}, async ({ edge, logs }) => {
    await jsonPost(edge.ports.gateway, `/api/companies/${COMPANY}/issues`, { title: "SECRET-BODY-TEXT" }, { authorization: "Bearer SECRET-KEY-TEXT" });
    await req(edge.ports.gateway, "GET", "/api/agents", { headers: { authorization: "Bearer SECRET-KEY-TEXT" } });
    const text = JSON.stringify(logs);
    assert.ok(logs.length >= 3);
    assert.ok(!text.includes("SECRET-KEY-TEXT") && !text.includes("SECRET-BODY-TEXT"));
  });
});

// ---- the CONNECT proxy and the inbound forwarder --------------------------------------------

function connectVia(proxyPort, target) {
  return new Promise((resolve) => {
    const s = net.connect(proxyPort, "127.0.0.1", () => s.write(`CONNECT ${target} HTTP/1.1\r\nhost: ${target}\r\n\r\n`));
    let out = "";
    s.on("data", (d) => { out += d; if (/\r\n\r\n/.test(out)) resolve({ socket: s, head: out.split("\r\n")[0], out }); });
    s.on("error", () => resolve({ socket: s, head: "error", out }));
    s.on("close", () => resolve({ socket: s, head: out.split("\r\n")[0] || "closed", out }));
  });
}

test("proxy: tunnels only to listed hosts and ports, never to Paperclip, and plain HTTP is refused", async () => {
  const echo = net.createServer((c) => c.on("data", (d) => c.write(d)));
  const echoPort = await listen(echo);
  try {
    await withEdge({ allow: "127.0.0.1,localhost,paperclip.example", connectPorts: [echoPort], env: { PAPERCLIP_UPSTREAM_URL: "http://paperclip.example:3100/api" } }, async ({ edge, logs }) => {
      const p = edge.ports.proxy;
      const ok = await connectVia(p, `127.0.0.1:${echoPort}`);
      assert.match(ok.head, /200/);
      const echoed = await new Promise((r) => { ok.socket.once("data", (d) => r(String(d))); ok.socket.write("ping"); });
      assert.equal(echoed, "ping");
      ok.socket.destroy();

      assert.match((await connectVia(p, `127.0.0.1:${echoPort + 1}`)).head, /403/, "port not listed");
      assert.match((await connectVia(p, `paperclip.example:${echoPort}`)).head, /403/, "Paperclip host");
      assert.match((await connectVia(p, `paperclip.example:443`)).head, /403/, "Paperclip host on 443");
      assert.match((await connectVia(p, `elsewhere.example:${echoPort}`)).head, /403/, "host not listed");
      assert.match((await connectVia(p, `localhost:${echoPort}`)).head, /403/, "a listed NAME that resolves to loopback");
      const plain = await req(p, "GET", `http://127.0.0.1:${echoPort}/`);
      assert.equal(plain.status, 403);
      assert.ok(logs.some((l) => l.reason === "resolves-to-private-address"));
    });
  } finally {
    echo.close();
  }
});

test("proxy: a listed host name whose resolver answer is loopback is refused (resolver injected)", async () => {
  const echo = net.createServer((c) => c.on("data", (d) => c.write(d)));
  const echoPort = await listen(echo);
  try {
    await withEdge({ allow: "api.example.com", connectPorts: [echoPort], lookup: async () => [{ address: "127.0.0.1", family: 4 }] }, async ({ edge }) => {
      assert.match((await connectVia(edge.ports.proxy, `api.example.com:${echoPort}`)).head, /403/, "resolves to loopback: refused");
    });
  } finally {
    echo.close();
  }
});

test("forwarder: inbound TCP reaches the node container's address and nothing else is exposed", async () => {
  const node = net.createServer((c) => c.on("data", (d) => c.write(`node:${d}`)));
  const nodePort = await listen(node);
  try {
    await withEdge({ forwardTo: { host: "127.0.0.1", port: nodePort } }, async ({ edge }) => {
      const reply = await new Promise((resolve) => {
        const s = net.connect(edge.ports.forward, "127.0.0.1", () => s.write("hello"));
        s.once("data", (d) => { resolve(String(d)); s.destroy(); });
      });
      assert.equal(reply, "node:hello");
    });
  } finally {
    node.close();
  }
});
