// The only door in and the only door out of one customer's NODE. No dependencies.
//
//   :7770  inbound   TCP forwarder to the node container (what the host publishes on loopback)
//   :8890  gateway   the ONLY way to Paperclip. Enforces policy.mjs on every request, whatever
//                    Paperclip itself would allow. The node is configured with http://edge:8890/api
//   :8888  proxy     CONNECT tunnels to the hosts in EDGE_ALLOW on port 443, nothing else. Plain
//                    HTTP through it is refused, and so is any tunnel to the Paperclip host.
//
// Why a gateway and not a path filter on the proxy: Node's environment proxy support sends
// even http:// requests as CONNECT, which hides the path. A tunnel cannot be scoped, so Paperclip
// is not reachable through one.
//
// UNTESTED as an image: written without a Docker daemon. The logic below is exercised by
// customer/edge/edge.test.mjs against real sockets.
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import { pathToFileURL } from "node:url";
import { classify, classifyConnect, GATEWAY_PREFIX, REASONS, UUID } from "./policy.mjs";
import { IssueStore } from "./issues.mjs";

export class ConfigError extends Error {
  constructor(problems) {
    super(`edge cannot start:\n  - ${problems.join("\n  - ")}`);
    this.problems = problems;
  }
}

const HOST_ENTRY = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const num = (v, d) => (v === undefined || v === "" ? d : Number(v));

/** Reads and validates the environment. Problems name variables, never values. */
export function loadConfig(env = process.env) {
  const problems = [];
  const allowHosts = new Set();
  for (const raw of String(env.EDGE_ALLOW ?? "").split(",")) {
    const h = raw.replace(/\s+/g, "");
    if (!h) continue;
    if (!HOST_ENTRY.test(h)) problems.push("EDGE_ALLOW has an entry that is not a plain host name or IPv4 address");
    else allowHosts.add(h.toLowerCase());
  }
  if (allowHosts.size === 0) problems.push("EDGE_ALLOW lists no hosts");

  const companyId = String(env.PAPERCLIP_COMPANY_ID ?? "").trim();
  if (!UUID.test(companyId)) problems.push("PAPERCLIP_COMPANY_ID must be a UUID");

  let upstream = null;
  try {
    const u = new URL(String(env.PAPERCLIP_UPSTREAM_URL ?? ""));
    if (!/^https?:$/.test(u.protocol)) throw new Error("scheme");
    if (u.username || u.password || u.search || u.hash) throw new Error("parts");
    if (!HOST_ENTRY.test(u.hostname)) throw new Error("host");
    upstream = {
      protocol: u.protocol,
      hostname: u.hostname.toLowerCase(),
      port: Number(u.port || (u.protocol === "https:" ? 443 : 80)),
      base: u.pathname.replace(/\/+$/, ""),
    };
  } catch {
    problems.push("PAPERCLIP_UPSTREAM_URL must be an http(s) URL with a plain host name or IPv4 address, no credentials, query or fragment");
  }

  const limits = {
    maxBody: num(env.EDGE_MAX_BODY, 262144),
    maxResponse: num(env.EDGE_MAX_RESPONSE, 4 * 1024 * 1024),
    maxIssues: num(env.EDGE_MAX_ISSUES, 2000),
    upstreamTimeoutMs: num(env.EDGE_UPSTREAM_TIMEOUT_MS, 30_000),
    connectTimeoutMs: num(env.EDGE_CONNECT_TIMEOUT_MS, 10_000),
    tunnelIdleMs: num(env.EDGE_TUNNEL_IDLE_MS, 120_000),
    forwardIdleMs: num(env.EDGE_FORWARD_IDLE_MS, 900_000),
    headersTimeoutMs: num(env.EDGE_HEADERS_TIMEOUT_MS, 10_000),
    requestTimeoutMs: num(env.EDGE_REQUEST_TIMEOUT_MS, 30_000),
    maxConnections: num(env.EDGE_MAX_CONNECTIONS, 128),
  };
  for (const [k, v] of Object.entries(limits)) if (!Number.isInteger(v) || v < 1) problems.push(`EDGE limit ${k} must be a positive integer`);

  const [upHost, upPort] = String(env.EDGE_UPSTREAM ?? "node:7770").split(":");
  if (!HOST_ENTRY.test(upHost ?? "") || !/^[0-9]{1,5}$/.test(upPort ?? "")) problems.push("EDGE_UPSTREAM must be host:port");

  const ports = {
    forward: num(env.EDGE_FORWARD_PORT, 7770),
    proxy: num(env.EDGE_PROXY_PORT, 8888),
    gateway: num(env.EDGE_GATEWAY_PORT, 8890),
  };
  for (const [k, v] of Object.entries(ports)) if (!Number.isInteger(v) || v < 0 || v > 65535) problems.push(`EDGE ${k} port is not a port number`);

  const connectPorts = String(env.EDGE_CONNECT_PORTS ?? "443").split(",").map((x) => Number(x.trim()));
  if (connectPorts.some((p) => !Number.isInteger(p) || p < 1 || p > 65535)) problems.push("EDGE_CONNECT_PORTS must be a comma-separated list of ports");

  if (problems.length) throw new ConfigError(problems);
  return {
    allowHosts,
    companyId,
    upstream,
    limits,
    ports,
    connectPorts,
    forwardTo: { host: upHost, port: Number(upPort) },
    stateDir: env.EDGE_STATE_DIR ?? "/state",
    bind: env.EDGE_BIND ?? "0.0.0.0",
  };
}

// ---- small helpers ------------------------------------------------------------------

function defaultLog(o) {
  console.log(JSON.stringify({ t: new Date().toISOString(), ...o }));
}

/** Request targets are untrusted: log them as a short JSON string with control characters made visible. */
const shown = (s) => JSON.stringify(String(s).slice(0, 160));

function sendJson(res, status, obj, extra = {}) {
  const body = JSON.stringify(obj);
  if (res.headersSent) return res.destroy();
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    connection: "close",
    ...extra,
  });
  res.end(body);
}

const refuse = (res, reason, status = 403) => sendJson(res, status, { error: status === 403 ? "forbidden" : "refused", reason, message: REASONS[reason] ?? "Refused." });

const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^192\.0\.0\./, /^22[4-9]\.|^2[3-5]\d\./];
/** Loopback, private, link-local, CGNAT / tailnet, multicast, ULA. */
export function isPrivateAddress(addr) {
  if (net.isIPv4(addr)) return PRIVATE_V4.some((r) => r.test(addr));
  const a = addr.toLowerCase();
  if (a === "::" || a === "::1") return true;
  if (a.startsWith("::ffff:")) return isPrivateAddress(a.slice(7));
  return /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || a.startsWith("ff");
}

// ---- the Paperclip gateway ------------------------------------------------------------

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > max) {
        reject(Object.assign(new Error("too large"), { code: "TOO_LARGE" }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
    req.on("aborted", () => reject(Object.assign(new Error("aborted"), { code: "ABORTED" })));
  });
}

function callUpstream(cfg, { method, path, headers, body }) {
  const { upstream, limits } = cfg;
  const mod = upstream.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const r = mod.request(
      { protocol: upstream.protocol, hostname: upstream.hostname, port: upstream.port, method, path: upstream.base + path, headers, agent: false, timeout: limits.upstreamTimeoutMs },
      (resp) => {
        const chunks = [];
        let n = 0;
        resp.on("data", (c) => {
          n += c.length;
          if (n > limits.maxResponse) {
            reject(Object.assign(new Error("response too large"), { code: "UPSTREAM_TOO_LARGE" }));
            r.destroy();
            return;
          }
          chunks.push(c);
        });
        resp.on("end", () => resolve({ status: resp.statusCode ?? 502, contentType: String(resp.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }));
        resp.on("error", reject);
      },
    );
    r.on("timeout", () => {
      reject(Object.assign(new Error("timeout"), { code: "UPSTREAM_TIMEOUT" }));
      r.destroy();
    });
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}

/** How often Node looks for connections past their header/request timeout (its default is 30 s). */
const checkEvery = (l) => Math.max(100, Math.min(5000, Math.floor(Math.min(l.headersTimeoutMs, l.requestTimeoutMs) / 2)));

const SAFE_AUTH = /^[\x20-\x7e]{1,4096}$/;
const SAFE_CT = /^[\x20-\x7e]{1,128}$/;

export function makeGateway(cfg, store, log) {
  const { limits } = cfg;
  return async function gateway(req, res) {
    const started = Date.now();
    const method = req.method ?? "";
    const target = req.url ?? "";
    const done = (decision, reason, extra = {}) => log({ ev: "gateway", decision, reason, method, target: shown(target), ms: Date.now() - started, ...extra });

    const d = classify({ method, target, companyId: cfg.companyId, hasIssue: (id) => store.has(id) });
    if (!d.allow) {
      done("deny", d.reason);
      return refuse(res, d.reason);
    }

    // Body rules before any byte goes upstream.
    const te = req.headers["transfer-encoding"];
    const cl = req.headers["content-length"];
    const len = cl === undefined ? 0 : Number(cl);
    if (te !== undefined) {
      done("deny", "chunked-not-allowed");
      return refuse(res, "chunked-not-allowed");
    }
    if (cl !== undefined && !/^[0-9]{1,12}$/.test(cl)) {
      done("deny", "bad-content-length");
      return refuse(res, "bad-content-length", 400);
    }
    let body = null;
    if (method === "GET") {
      if (len > 0) {
        done("deny", "body-not-allowed");
        return refuse(res, "body-not-allowed");
      }
    } else {
      if (cl === undefined) {
        done("deny", "length-required");
        return refuse(res, "length-required", 411);
      }
      if (len > limits.maxBody) {
        done("deny", "body-too-large", { bytes: len });
        return refuse(res, "body-too-large", 413);
      }
      if (!/^application\/json(\s*;|$)/i.test(String(req.headers["content-type"] ?? ""))) {
        done("deny", "content-type");
        return refuse(res, "content-type", 415);
      }
      try {
        body = await readBody(req, limits.maxBody);
      } catch (e) {
        done("deny", e.code === "TOO_LARGE" ? "body-too-large" : "body-aborted");
        return e.code === "TOO_LARGE" ? refuse(res, "body-too-large", 413) : res.destroy();
      }
      let parsed;
      try {
        parsed = JSON.parse(body.toString("utf8"));
      } catch {
        parsed = null;
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        done("deny", "invalid-json");
        return refuse(res, "invalid-json", 400);
      }
    }

    // Only these headers go upstream. Host is ours, never the caller's.
    const headers = { host: cfg.upstream.hostname + (cfg.upstream.port === (cfg.upstream.protocol === "https:" ? 443 : 80) ? "" : `:${cfg.upstream.port}`), accept: "application/json", "accept-encoding": "identity", connection: "close" };
    const auth = req.headers.authorization;
    if (typeof auth === "string" && SAFE_AUTH.test(auth)) headers.authorization = auth;
    if (body) {
      headers["content-type"] = "application/json";
      headers["content-length"] = String(body.length);
    }

    let up;
    try {
      up = await callUpstream(cfg, { method, path: d.path, headers, body });
    } catch (e) {
      const reason = e.code === "UPSTREAM_TIMEOUT" ? "upstream-timeout" : e.code === "UPSTREAM_TOO_LARGE" ? "upstream-response-too-large" : "upstream-unreachable";
      done("error", reason);
      return sendJson(res, e.code === "UPSTREAM_TIMEOUT" ? 504 : 502, { error: "bad_gateway", reason });
    }
    if (up.status >= 300 && up.status < 400) {
      done("error", "upstream-redirect", { status: up.status });
      return sendJson(res, 502, { error: "bad_gateway", reason: "upstream-redirect" });
    }

    // Defence in depth: whatever Paperclip returns for an issue must belong to this company.
    let doc = null;
    if ((d.route === "issues:create" || d.route === "issue:get") && up.status >= 200 && up.status < 300) {
      try {
        doc = JSON.parse(up.body.toString("utf8"));
      } catch {
        doc = null;
      }
      if (doc && typeof doc === "object" && typeof doc.companyId === "string" && doc.companyId !== cfg.companyId) {
        done("error", "upstream-company-mismatch");
        return sendJson(res, 502, { error: "bad_gateway", reason: "upstream-company-mismatch" });
      }
    }
    let recorded = false;
    if (d.route === "issues:create" && (up.status === 200 || up.status === 201) && doc && typeof doc.id === "string") recorded = store.add(doc.id);

    done("allow", d.route, { status: up.status, recorded });
    res.writeHead(up.status, {
      "content-type": SAFE_CT.test(up.contentType) ? up.contentType : "application/json",
      "content-length": up.body.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      connection: "close",
    });
    res.end(up.body);
  };
}

// ---- the CONNECT proxy ----------------------------------------------------------------

function connectDeny(socket, reason) {
  const body = JSON.stringify({ error: "forbidden", reason, message: REASONS[reason] ?? "Refused." });
  socket.end(`HTTP/1.1 403 Forbidden\r\ncontent-type: application/json\r\ncontent-length: ${Buffer.byteLength(body)}\r\nconnection: close\r\n\r\n${body}`);
}

export function makeProxy(cfg, log, lookup = dns.promises.lookup) {
  const { limits } = cfg;
  const server = http.createServer({ maxHeaderSize: 8192, connectionsCheckingInterval: checkEvery(limits) }, (req, res) => {
    // Plain HTTP through the proxy is never needed: the platform API is https, Paperclip has the gateway.
    log({ ev: "proxy", decision: "deny", reason: "plain-http", method: req.method, target: shown(req.url) });
    refuse(res, "host-not-allowed");
  });
  server.maxConnections = limits.maxConnections;
  server.headersTimeout = limits.headersTimeoutMs;
  server.requestTimeout = limits.requestTimeoutMs;

  server.on("connect", async (req, client, head) => {
    client.on("error", () => client.destroy());
    const d = classifyConnect({ target: req.url, allowHosts: cfg.allowHosts, ports: cfg.connectPorts, paperclipHost: cfg.upstream.hostname });
    if (!d.allow) {
      log({ ev: "proxy", decision: "deny", reason: d.reason, target: shown(req.url) });
      return connectDeny(client, d.reason);
    }
    // A host NAME must not resolve into the host's own networks (loopback, LAN, tailnet, link-local).
    // A listed IP address is the operator's explicit choice and is taken as given.
    let addr = d.host;
    if (!net.isIP(d.host)) {
      try {
        const all = await lookup(d.host, { all: true });
        if (!all.length || all.some((a) => isPrivateAddress(a.address))) {
          log({ ev: "proxy", decision: "deny", reason: "resolves-to-private-address", target: shown(req.url) });
          return connectDeny(client, "host-not-allowed");
        }
        addr = all[0].address;
      } catch {
        log({ ev: "proxy", decision: "error", reason: "dns-failed", target: shown(req.url) });
        return client.end("HTTP/1.1 502 Bad Gateway\r\nconnection: close\r\n\r\n");
      }
    }
    const upstream = net.connect({ host: addr, port: d.port });
    upstream.setTimeout(limits.connectTimeoutMs, () => upstream.destroy());
    upstream.on("error", () => {
      if (!client.destroyed && !client.writableEnded) client.end("HTTP/1.1 502 Bad Gateway\r\nconnection: close\r\n\r\n");
      client.destroy();
    });
    upstream.on("connect", () => {
      upstream.setTimeout(limits.tunnelIdleMs, () => upstream.destroy());
      client.setTimeout(limits.tunnelIdleMs, () => client.destroy());
      log({ ev: "proxy", decision: "allow", reason: "connect", host: d.host, port: d.port });
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head && head.length) upstream.write(head);
      upstream.pipe(client);
      client.pipe(upstream);
    });
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  });
  return server;
}

// ---- inbound forwarder ------------------------------------------------------------------

export function makeForwarder(cfg, log) {
  const server = net.createServer((client) => {
    const up = net.connect(cfg.forwardTo);
    up.setTimeout(cfg.limits.connectTimeoutMs, () => up.destroy());
    up.on("connect", () => {
      up.setTimeout(cfg.limits.forwardIdleMs, () => up.destroy());
      client.pipe(up);
      up.pipe(client);
    });
    client.setTimeout(cfg.limits.forwardIdleMs, () => client.destroy());
    client.on("error", () => up.destroy());
    up.on("error", () => client.destroy());
    client.on("close", () => up.destroy());
    up.on("close", () => client.destroy());
  });
  server.maxConnections = cfg.limits.maxConnections;
  server.on("error", (e) => log({ ev: "forward", error: e.code ?? "error" }));
  return server;
}

// ---- start ---------------------------------------------------------------------------------

const listen = (server, port, host) => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, host, () => resolve(server.address().port));
});

/** Starts all three listeners. Resolves with the bound ports and a close() for tests and shutdown. */
export async function start(cfg, { log = defaultLog, lookup } = {}) {
  const store = new IssueStore({ dir: cfg.stateDir, companyId: cfg.companyId, max: cfg.limits.maxIssues });
  const gw = http.createServer({ maxHeaderSize: 8192, connectionsCheckingInterval: checkEvery(cfg.limits) }, makeGateway(cfg, store, log));
  gw.maxConnections = cfg.limits.maxConnections;
  gw.headersTimeout = cfg.limits.headersTimeoutMs;
  gw.requestTimeout = cfg.limits.requestTimeoutMs;
  gw.keepAliveTimeout = 1000;
  gw.on("clientError", (_e, socket) => socket.writable && socket.end("HTTP/1.1 400 Bad Request\r\nconnection: close\r\n\r\n"));
  const proxy = makeProxy(cfg, log, lookup);
  proxy.on("clientError", (_e, socket) => socket.writable && socket.end("HTTP/1.1 400 Bad Request\r\nconnection: close\r\n\r\n"));
  const fwd = makeForwarder(cfg, log);

  const ports = {
    gateway: await listen(gw, cfg.ports.gateway, cfg.bind),
    proxy: await listen(proxy, cfg.ports.proxy, cfg.bind),
    forward: await listen(fwd, cfg.ports.forward, cfg.bind),
  };
  log({ ev: "start", ports, issuesKnown: store.size, scope: `${GATEWAY_PREFIX}/companies/<own>/issues` });
  return {
    ports,
    store,
    close: () => Promise.all([gw, proxy, fwd].map((s) => new Promise((r) => { s.close(() => r()); s.closeAllConnections?.(); }))),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const cfg = loadConfig();
    const edge = await start(cfg);
    const stop = () => void edge.close().then(() => process.exit(0));
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
  } catch (e) {
    console.error(e instanceof ConfigError ? e.message : `edge cannot start: ${e && e.code ? e.code : "error"}`);
    process.exit(e instanceof ConfigError ? 64 : 70);
  }
}
