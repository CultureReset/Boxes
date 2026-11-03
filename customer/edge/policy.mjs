// What this customer's container may ask Paperclip. Pure functions, no I/O.
//
// The node container reaches Paperclip only through the edge gateway, which
// calls classify() on every request. Anything that is not on this short list is
// refused, whatever Paperclip itself would have done with it:
//
//   POST|GET /api/companies/<COMPANY_ID>/issues      this container's own company
//   GET      /api/issues/<id>                        an id this container created
//   GET      /api/issues/<id>/comments               an id this container created
//
// Nothing is normalised and then trusted. A path is accepted only if it is
// already canonical: plain characters, no empty segment, no "." or ".." segment,
// no percent escapes, no query, no fragment. What is checked is byte for byte
// what is forwarded, so there is no second parser to disagree with.

/** The gateway's own path prefix. The node container is configured with <gateway>/api. */
export const GATEWAY_PREFIX = "api";

export const METHODS = new Set(["GET", "POST"]);

/** An issue id as the edge will record and accept it (Paperclip's are UUIDs; this is looser but still one path segment). */
export const ISSUE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Letters, digits and . _ ~ - only, with / between segments. This rejects "%" (every
// encoding trick, including encoded slashes and encoded dots), "\", ";", spaces,
// control characters, NUL and anything outside ASCII, before any segment is looked at.
const PLAIN_PATH = /^\/[A-Za-z0-9._~/-]*$/;

const MAX_TARGET = 1024;

/**
 * @param {{method: string, target: string, companyId: string, hasIssue: (id: string) => boolean}} req
 *   target is the raw request target exactly as received on the wire.
 * @returns {{allow: true, route: "issues:create"|"issues:list"|"issue:get"|"comments:get", issueId?: string, path: string}
 *          | {allow: false, reason: string}}
 *   path is the gateway-relative path without the "/api" prefix, e.g. "/issues/<id>".
 */
export function classify({ method, target, companyId, hasIssue }) {
  if (typeof method !== "string" || !METHODS.has(method)) return deny("method-not-allowed");
  if (typeof target !== "string" || target.length === 0 || target.length > MAX_TARGET) return deny("bad-target");
  if (target.includes("#")) return deny("fragment-not-allowed");
  if (target.includes("?")) return deny("query-not-allowed");
  if (!PLAIN_PATH.test(target)) return deny("path-characters-not-allowed");

  const segs = target.slice(1).split("/");
  for (const s of segs) {
    if (s === "") return deny("empty-path-segment");
    if (s === "." || s === "..") return deny("dot-segment");
  }
  if (segs[0] !== GATEWAY_PREFIX) return deny("out-of-scope");
  const rest = segs.slice(1);
  const path = "/" + rest.join("/");

  // /companies/<this company>/issues
  if (rest.length === 3 && rest[0] === "companies" && rest[2] === "issues") {
    if (rest[1] !== companyId) return deny("other-company");
    return { allow: true, route: method === "POST" ? "issues:create" : "issues:list", path };
  }
  // /issues/<id> and /issues/<id>/comments, for ids created here only
  if ((rest.length === 2 || (rest.length === 3 && rest[2] === "comments")) && rest[0] === "issues") {
    if (method !== "GET") return deny("method-not-allowed-for-route");
    const id = rest[1];
    if (!ISSUE_ID.test(id) || !hasIssue(id)) return deny("issue-not-created-here");
    return { allow: true, route: rest.length === 2 ? "issue:get" : "comments:get", issueId: id, path };
  }
  return deny("out-of-scope");
}

function deny(reason) {
  return { allow: false, reason };
}

/** Human text for a refusal. Fixed strings only: nothing the caller sent is echoed back. */
export const REASONS = {
  "method-not-allowed": "This method is not allowed.",
  "method-not-allowed-for-route": "This method is not allowed on this path.",
  "bad-target": "The request target is not acceptable.",
  "fragment-not-allowed": "Fragments are not allowed.",
  "query-not-allowed": "Query strings are not allowed.",
  "path-characters-not-allowed": "The path contains characters that are not allowed.",
  "empty-path-segment": "The path has an empty segment.",
  "dot-segment": "The path has a dot segment.",
  "out-of-scope": "This path is not available to this container.",
  "other-company": "That company is not this container's company.",
  "issue-not-created-here": "That issue was not created by this container.",
  "chunked-not-allowed": "Chunked request bodies are not allowed; send a Content-Length.",
  "bad-content-length": "The Content-Length is not valid.",
  "body-not-allowed": "A GET request must not have a body.",
  "length-required": "A Content-Length is required.",
  "body-too-large": "The request body is too large.",
  "content-type": "The content type must be application/json.",
  "invalid-json": "The body must be a JSON object.",
  "paperclip-only-through-gateway": "Paperclip is reachable only through the scoped gateway.",
  "host-not-allowed": "This host is not on the allow-list.",
  "port-not-allowed": "This port is not allowed.",
};

/** CONNECT target "host:port" -> {host, port} or null. Lower-cases the host. */
export function parseConnectTarget(target) {
  const m = /^([A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?):([0-9]{1,5})$/.exec(target ?? "");
  if (!m) return null;
  const port = Number(m[3]);
  if (port < 1 || port > 65535) return null;
  return { host: m[1].toLowerCase(), port };
}

/**
 * May this container open a tunnel to host:port? Only listed hosts, only the
 * listed ports, and never the Paperclip host (that would bypass the gateway).
 */
export function classifyConnect({ target, allowHosts, ports, paperclipHost }) {
  const t = parseConnectTarget(target);
  if (!t) return deny("bad-target");
  if (t.host === paperclipHost) return deny("paperclip-only-through-gateway");
  if (!allowHosts.has(t.host)) return deny("host-not-allowed");
  if (!ports.includes(t.port)) return deny("port-not-allowed");
  return { allow: true, host: t.host, port: t.port };
}
