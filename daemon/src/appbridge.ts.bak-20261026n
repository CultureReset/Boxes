import type http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { askPaperclipWait } from "./modules/paperclip.js";

/**
 * App bridge: one door for any app (Twenty, downloaded apps, agents) to reach
 * Paperclip's Lead the same way Jarvis does (paperclipAsk).
 *   POST /api/bridge/ask   {"request": "...", "title"?: "...", "source"?: "Twenty"}
 *   POST /api/bridge/mcp   MCP (JSON-RPC over HTTP), one tool: paperclipAsk
 * Auth: "Authorization: Bearer <token>" (or "x-node-token"). The token is
 * generated on first start into ~/.config/nodeos/app-token (mode 600).
 */
const TOKEN_FILE = process.env.NODEOS_APP_TOKEN_FILE ?? path.join(os.homedir(), ".config/nodeos/app-token");

function token(): string {
  if (!existsSync(TOKEN_FILE)) {
    mkdirSync(path.dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });
    writeFileSync(TOKEN_FILE, randomBytes(32).toString("hex") + "\n", { mode: 0o600 });
  }
  chmodSync(TOKEN_FILE, 0o600);
  return readFileSync(TOKEN_FILE, "utf8").trim();
}
token();

function authed(req: http.IncomingMessage): boolean {
  const h = req.headers.authorization ?? "";
  const got = (h.startsWith("Bearer ") ? h.slice(7) : String(req.headers["x-node-token"] ?? "")).trim();
  const want = token();
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function body(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const t = Buffer.concat(chunks).toString("utf8");
  return t ? JSON.parse(t) : {};
}

function send(res: http.ServerResponse, code: number, v: unknown): void {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(v));
}

const TOOL = {
  name: "paperclipAsk",
  description: "Send a request (question OR job) to Paperclip's Lead agent and wait for the answer. Returns Lead's answer text and the issue id.",
  inputSchema: { type: "object", properties: { request: { type: "string", description: "The full request in plain words" }, title: { type: "string", description: "Short title (optional)" } }, required: ["request"] },
};

export async function handleBridge(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (!authed(req)) return send(res, 401, { error: "NODE app token required (Authorization: Bearer <token>)" });
  const url = (req.url ?? "").split("?")[0];
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  let b: any;
  try { b = await body(req); } catch { return send(res, 400, { error: "bad JSON" }); }

  if (url === "/api/bridge/ask") {
    const request = String(b.request ?? b.prompt ?? "").trim();
    if (!request) return send(res, 400, { error: "request is required" });
    try {
      const r = await askPaperclipWait(request.slice(0, 20_000), String(b.source ?? "an app via NODE").slice(0, 60), b.title ? String(b.title) : undefined);
      return send(res, 200, r);
    } catch (e) { return send(res, 502, { error: (e as Error).message }); }
  }

  if (url === "/api/bridge/mcp") {
    const one = async (m: any): Promise<any> => {
      const id = m?.id;
      const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });
      switch (m?.method) {
        case "initialize": return reply({ protocolVersion: m.params?.protocolVersion ?? "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "node-paperclip", version: "1.0.0" } });
        case "notifications/initialized": return null;
        case "ping": return reply({});
        case "tools/list": return reply({ tools: [TOOL] });
        case "tools/call": {
          if (m.params?.name !== "paperclipAsk") return { jsonrpc: "2.0", id, error: { code: -32602, message: "unknown tool" } };
          const a = m.params?.arguments ?? {};
          try {
            const r = await askPaperclipWait(String(a.request ?? "").slice(0, 20_000), "an MCP client via NODE", a.title);
            return reply({ content: [{ type: "text", text: `${r.issue} (${r.status}, ${r.seconds}s): ${r.answer}` }], isError: !r.ok && r.status !== "still_working" });
          } catch (e) { return reply({ content: [{ type: "text", text: `paperclipAsk failed: ${(e as Error).message}` }], isError: true }); }
        }
        default: return id === undefined ? null : { jsonrpc: "2.0", id, error: { code: -32601, message: "method not found" } };
      }
    };
    const out = Array.isArray(b) ? (await Promise.all(b.map(one))).filter(Boolean) : await one(b);
    if (!out || (Array.isArray(out) && !out.length)) { res.writeHead(202); res.end(); return; }
    return send(res, 200, out);
  }
  return send(res, 404, { error: "Not found" });
}
