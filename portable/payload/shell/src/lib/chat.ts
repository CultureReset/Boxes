import { api } from "../api/client";
import { door } from "./door";
import type { Attachment, Chat, ChatMessage } from "../api/types";

/** The chat being shown, and the model last picked. Both survive a reload. */
export const AGENT = "agent";
export const store = {
  get chat(): string | null { return localStorage.getItem("node.chat"); },
  set chat(v: string | null) { v ? localStorage.setItem("node.chat", v) : localStorage.removeItem("node.chat"); },
  get model(): string { return localStorage.getItem("node.model") ?? AGENT; },
  set model(v: string) { localStorage.setItem("node.model", v); },
  get autoSend(): boolean { return localStorage.getItem("node.voiceAutoSend") !== "0"; },
};

export interface Outgoing { text: string; model: string; attachments: Attachment[] }

export function sendChat(chat: string | null, o: Outgoing): Promise<{ chat: Chat; reply: ChatMessage }> {
  return api.post("/api/chat/send", { chat, text: o.text, model: o.model, attachments: o.attachments.map((a) => a.id) });
}

/** Streamed send: calls onDelta per token; resolves with the saved chat. */
export async function streamChat(chat: string | null, o: Outgoing, onDelta: (t: string) => void): Promise<{ chat: Chat; reply: ChatMessage }> {
  const r = await fetch("/api/chat/stream", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat, text: o.text, model: o.model, attachments: o.attachments.map((a) => a.id) }) });
  if (r.status === 401) window.dispatchEvent(new Event("node:signed-out"));
  if (!r.ok || !r.body) {
    const t = await r.text().catch(() => "");
    try { throw new Error(JSON.parse(t).error ?? `HTTP ${r.status}`); } catch (e) { throw e instanceof SyntaxError ? new Error(`HTTP ${r.status}`) : e; }
  }
  const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = ""; let done: { chat: Chat; reply: ChatMessage } | null = null;
  for (;;) {
    const { value, done: end } = await rd.read();
    if (value) buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const m = JSON.parse(line) as { delta?: string; done?: boolean; chat?: Chat; reply?: ChatMessage; error?: string };
      if (m.delta) onDelta(m.delta);
      if (m.error) throw new Error(m.error);
      if (m.done && m.chat && m.reply) done = { chat: m.chat, reply: m.reply };
    }
    if (end) break;
  }
  if (!done) throw new Error("The reply was cut off; try again.");
  return done;
}

interface IntentStep { mode: "read" | "write"; status: string; summary?: string; capability: string; backend: string; approve_url?: string; preview?: { title?: string } }
/** Agent mode: Ask NODE (door /intent). Reads are answered; changes become an approval request. Never throws a raw error. */
export async function askAgent(chat: string | null, text: string): Promise<{ chat: Chat; reply: ChatMessage }> {
  let reply: string;
  try {
    const it = await door.post<{ answer?: string; steps?: IntentStep[] }>("/intent", { text: text.slice(0, 2000) });
    const parts = [it.answer?.trim() || ""];
    for (const s of it.steps ?? []) {
      if (s.mode !== "write") continue;
      const what = s.preview?.title || s.summary || s.capability.replace(/^(gw|mcp):/, "");
      if (s.status === "pending") parts.push(`**Change waiting for your YES:** ${what}\n\nI texted you the approval — reply YES + your code${s.approve_url ? `, or [approve here](/door${s.approve_url})` : ""}.`);
      else parts.push(`**Change (${s.status}):** ${what}`);
    }
    reply = parts.filter(Boolean).join("\n\n") || "(NODE had no answer)";
  } catch (e) {
    reply = `Ask NODE couldn't answer: ${e instanceof Error ? e.message : "unknown error"}`;
  }
  return api.post<{ chat: Chat }>("/api/chat/log", { source: "agent", chat, items: [{ role: "user", text }, { role: "assistant", text: reply }] })
    .then(({ chat: c }) => ({ chat: c, reply: c.messages[c.messages.length - 1] }));
}

/** Talk to NODE lines into today's "Talk to NODE" chat (best-effort). */
export function logTalk(role: "user" | "assistant", text: string) {
  if (text) void api.post("/api/chat/log", { source: "talk", items: [{ role, text }] }).catch(() => {});
}

export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function uploadFile(f: File): Promise<Attachment> {
  if (f.size > 28 * 1024 * 1024) throw new Error(`${f.name} is over 28 MB`);
  return api.post<Attachment>("/api/chat/upload", { name: f.name, type: f.type, data: await toBase64(f) });
}
