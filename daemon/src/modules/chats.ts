import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DATA_DIR } from "../paths.js";
import { ask } from "./agents.js";
import { getJob } from "./jobs.js";
import type { ChatMsg } from "../voice/llm.js";

/** Full-screen chat conversations, one JSON file each under DATA_DIR/chats. */
export interface ChatMessage { role: "user" | "assistant"; content: string; at: string; model?: string; provider?: string; failed?: boolean }
export interface Chat { id: string; title: string; createdAt: string; updatedAt: string; model?: string; provider?: string; persona?: string; messages: ChatMessage[]; pendingJob?: string }

const DIR = path.join(DATA_DIR, "chats");
const file = (id: string) => {
  if (!/^[a-z0-9]{6,32}$/.test(id)) throw new Error("bad chat id");
  return path.join(DIR, `${id}.json`);
};

async function save(c: Chat): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(file(c.id), JSON.stringify(c, null, 1));
}

export async function getChat(id: string): Promise<Chat | null> {
  try { return JSON.parse(await readFile(file(id), "utf8")) as Chat; } catch { return null; }
}

export async function listChats(): Promise<Array<Omit<Chat, "messages"> & { count: number }>> {
  await mkdir(DIR, { recursive: true });
  const out = [];
  for (const f of await readdir(DIR)) {
    if (!f.endsWith(".json")) continue;
    const c = await getChat(f.slice(0, -5));
    if (c) { const { messages, ...rest } = c; out.push({ ...rest, count: messages.length }); }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteChat(id: string): Promise<{ ok: true }> {
  await unlink(file(id)).catch(() => undefined);
  return { ok: true };
}

export async function sendChat(id: string | null, text: string, opts: { model?: string; provider?: string; persona?: string }): Promise<{ chat: Chat; jobId: string }> {
  const now = new Date().toISOString();
  let chat = id ? await getChat(id) : null;
  if (!chat) chat = { id: randomBytes(8).toString("hex"), title: text.replace(/\s+/g, " ").slice(0, 60), createdAt: now, updatedAt: now, messages: [] };
  if (opts.model) chat.model = opts.model;
  if (opts.provider !== undefined) chat.provider = opts.provider || undefined;
  if (opts.persona) chat.persona = opts.persona;
  const history: ChatMsg[] = chat.messages.filter((m) => !m.failed && m.content.trim()).map((m) => ({ role: m.role, content: m.content }));
  chat.messages.push({ role: "user", content: text, at: now });
  const job = await ask(text, chat.persona || "general", chat.provider, undefined, chat.model, history);
  chat.pendingJob = job.id;
  chat.updatedAt = now;
  await save(chat);
  const chatId = chat.id;
  void (async () => {
    for (let i = 0; i < 1200; i++) {
      const j = getJob(job.id);
      if (!j || j.status !== "running") {
        const c = (await getChat(chatId)) ?? chat!;
        const content = (j?.lines ?? []).join("\n").trim();
        c.messages.push({ role: "assistant", content: content || "(no reply)", at: new Date().toISOString(), model: c.model, provider: String(j?.meta?.provider ?? c.provider ?? ""), failed: !j || j.status !== "done" });
        delete c.pendingJob;
        c.updatedAt = new Date().toISOString();
        await save(c);
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  })();
  return { chat, jobId: job.id };
}
