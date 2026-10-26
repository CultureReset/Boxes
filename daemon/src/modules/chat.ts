import { mkdir, readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { JsonStore, id } from "../store.js";
import { HOME } from "../paths.js";
import { run } from "../exec.js";
import { HttpError } from "../router.js";
import { transcribe } from "../voice/stt.js";

/**
 * Chat with a chosen model.
 *
 * Local models go to llama-swap (:8080). Cloud routes (deepseek*, grok*) go
 * to LiteLLM (:4000), whose key is read from its env file at call time and
 * never logged or returned. Uploads live on the 2 TB HDD, not the SSD.
 */

const SWAP = (process.env.NODEOS_LLM_URL ?? "http://127.0.0.1:8080/v1").replace(/\/$/, "");
const LITELLM = (process.env.NODEOS_LITELLM_URL ?? "http://127.0.0.1:4000/v1").replace(/\/$/, "");
const LITELLM_ENV = process.env.NODEOS_LITELLM_ENV ?? path.join(HOME, ".config/litellm/litellm.env");
export const UPLOAD_DIR = process.env.NODEOS_UPLOAD_DIR ?? "/hdd/home/steve/nodeos/uploads";
const VISION_MODEL = process.env.NODEOS_VISION_MODEL ?? "v4";
const VISION = new Set([VISION_MODEL]);
/** Not chat models: speech, its projector, embeddings. */
const NOT_CHAT = /^(asr|asr-proj|.*-proj|nomic-embed.*|.*embed.*)$/;
const CLOUD = /^(deepseek|grok)/;

export interface ChatModel { id: string; via: "llama-swap" | "litellm"; label: string; vision: boolean }
export interface Attachment { id: string; name: string; type: string; size: number; kind: "image" | "pdf" | "text" | "other"; chars: number }
export interface ChatMessage { role: "user" | "assistant"; content: string; at: string; model?: string; attachments?: Attachment[]; error?: boolean }
export interface Chat { id: string; title: string; model: string; createdAt: string; updatedAt: string; messages: ChatMessage[] }

const chats = new JsonStore<Chat[]>("chats", () => []);
const uploads = new JsonStore<Record<string, Attachment & { file: string; textFile?: string }>>("uploads", () => ({}));

async function litellmKey(): Promise<string> {
  try {
    const m = (await readFile(LITELLM_ENV, "utf8")).match(/^LITELLM_MASTER_KEY=["']?([^"'\n]+)/m);
    return m?.[1] ?? "";
  } catch {
    return "";
  }
}

async function listIds(base: string, key?: string): Promise<string[]> {
  try {
    const r = await fetch(`${base}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return [];
    return ((await r.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? [];
  } catch {
    return [];
  }
}

export async function models(): Promise<ChatModel[]> {
  const [local, cloud] = await Promise.all([listIds(SWAP), litellmKey().then((k) => listIds(LITELLM, k))]);
  const out: ChatModel[] = local.filter((m) => !NOT_CHAT.test(m)).map((m) => ({ id: m, via: "llama-swap", label: m, vision: VISION.has(m) }));
  for (const m of cloud.filter((m) => CLOUD.test(m)).sort()) out.push({ id: m, via: "litellm", label: `${m} (cloud)`, vision: /^grok/.test(m) });
  return out;
}

/* ---------- uploads ---------- */

function kindOf(name: string, type: string): Attachment["kind"] {
  const ext = path.extname(name).toLowerCase();
  if (type.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return "image";
  if (type === "application/pdf" || ext === ".pdf") return "pdf";
  if (type.startsWith("text/") || [".txt", ".csv", ".md", ".json", ".log", ".tsv", ".yaml", ".yml", ".xml", ".html"].includes(ext)) return "text";
  return "other";
}

const MAX_TEXT = 60_000;

export async function upload(name: string, type: string, data: Buffer): Promise<Attachment> {
  if (!data.length) throw new HttpError(400, "Empty file");
  const safe = path.basename(name).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
  const day = new Date().toISOString().slice(0, 10);
  const dir = path.join(UPLOAD_DIR, day);
  await mkdir(dir, { recursive: true });
  const uid = id();
  const file = path.join(dir, `${uid}-${safe}`);
  await writeFile(file, data, { flag: "wx" });
  const kind = kindOf(safe, type);
  let text = "";
  if (kind === "pdf") {
    const r = await run("pdftotext", ["-layout", file, "-"], { timeout: 60_000 });
    text = r.ok ? r.stdout : "";
  } else if (kind === "text") {
    text = data.toString("utf8");
  }
  text = text.slice(0, MAX_TEXT);
  let textFile: string | undefined;
  if (text) {
    textFile = `${file}.txt`;
    await writeFile(textFile, text, { flag: "wx" });
  }
  const att: Attachment = { id: uid, name: safe, type: type || "application/octet-stream", size: data.length, kind, chars: text.length };
  await uploads.update((u) => ({ ...u, [uid]: { ...att, file, textFile } }));
  return att;
}

export async function uploadFile(uid: string): Promise<{ file: string; type: string; name: string }> {
  const u = (await uploads.read())[uid];
  if (!u) throw new HttpError(404, "No such upload");
  return { file: u.file, type: u.type, name: u.name };
}

/* ---------- speech ---------- */

/** Any browser recording (webm/opus, mp4/aac, wav) -> 16 kHz mono WAV -> asr. */
export async function transcribeAny(audio: Buffer, mime: string): Promise<string> {
  if (!audio.length) throw new HttpError(400, "No audio");
  const dir = await mkdtemp(path.join(tmpdir(), "nodeos-rec-"));
  try {
    const ext = /mp4|m4a|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : /wav/.test(mime) ? "wav" : "webm";
    const input = path.join(dir, `in.${ext}`);
    const out = path.join(dir, "out.wav");
    await writeFile(input, audio);
    const r = await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-ar", "16000", "-ac", "1", "-f", "wav", out], { timeout: 60_000 });
    if (!r.ok) throw new HttpError(422, "Could not read that recording");
    return await transcribe(await readFile(out));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/* ---------- chats ---------- */

export async function listChats(): Promise<Omit<Chat, "messages">[]> {
  return (await chats.read())
    .map(({ messages, ...c }) => ({ ...c, count: messages.length }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getChat(cid: string): Promise<Chat> {
  const c = (await chats.read()).find((x) => x.id === cid);
  if (!c) throw new HttpError(404, "No such chat");
  return c;
}

export async function deleteChat(cid: string): Promise<{ ok: true }> {
  await chats.update((all) => all.filter((c) => c.id !== cid));
  return { ok: true };
}

export async function setChatModel(cid: string, model: string): Promise<Chat> {
  const all = await chats.read();
  const c = all.find((x) => x.id === cid);
  if (!c) throw new HttpError(404, "No such chat");
  c.model = model;
  await chats.write(all);
  return c;
}

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

async function userContent(m: ChatMessage, withImages: boolean): Promise<string | Part[]> {
  const meta = await uploads.read();
  let text = m.content;
  const images: Part[] = [];
  for (const a of m.attachments ?? []) {
    const u = meta[a.id];
    if (!u) continue;
    if (u.textFile) {
      const body = await readFile(u.textFile, "utf8").catch(() => "");
      text += `\n\n--- Attached file: ${u.name} ---\n${body}\n--- end of ${u.name} ---`;
    } else if (u.kind === "image") {
      if (withImages) {
        const b64 = (await readFile(u.file)).toString("base64");
        images.push({ type: "image_url", image_url: { url: `data:${u.type.startsWith("image/") ? u.type : "image/png"};base64,${b64}` } });
      } else text += `\n\n[Image attached earlier: ${u.name}]`;
    } else text += `\n\n[Attached file: ${u.name}, ${u.size} bytes, no text could be extracted]`;
  }
  return images.length ? [{ type: "text", text }, ...images] : text;
}

export async function send(cid: string | null, text: string, model: string, attachmentIds: string[]): Promise<{ chat: Chat; reply: ChatMessage }> {
  const available = await models();
  const meta = await uploads.read();
  const attachments = attachmentIds.map((a) => meta[a]).filter(Boolean).map(({ file: _f, textFile: _t, ...a }) => a as Attachment);
  const hasImage = attachments.some((a) => a.kind === "image");
  const chosen = available.find((m) => m.id === model);
  if (!chosen) throw new HttpError(400, `Model "${model}" is not available`);
  // Images need eyes. A model without them gets the turn routed to the vision model.
  const used = hasImage && !chosen.vision ? (available.find((m) => m.id === VISION_MODEL) ?? chosen) : chosen;

  const now = new Date().toISOString();
  const all = await chats.read();
  let chat = cid ? all.find((c) => c.id === cid) : undefined;
  if (!chat) {
    chat = { id: id(), title: (text || attachments[0]?.name || "New chat").slice(0, 60), model, createdAt: now, updatedAt: now, messages: [] };
    all.push(chat);
  }
  chat.model = model;
  const userMsg: ChatMessage = { role: "user", content: text, at: now, attachments: attachments.length ? attachments : undefined };
  chat.messages.push(userMsg);

  const history = chat.messages.slice(-20);
  const msgs = [];
  for (const m of history) {
    if (m.error) continue;
    msgs.push(m.role === "user" ? { role: "user", content: await userContent(m, used.vision && m === userMsg) } : { role: "assistant", content: m.content });
  }
  const base = used.via === "litellm" ? LITELLM : SWAP;
  const key = used.via === "litellm" ? await litellmKey() : "";
  let reply: ChatMessage;
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ model: used.id, messages: msgs, stream: false }),
      signal: AbortSignal.timeout(600_000),
    });
    const j = (await r.json().catch(() => ({}))) as { choices?: { message?: { content?: string; reasoning_content?: string } }[]; error?: { message?: string } | string };
    if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : (j.error?.message ?? `HTTP ${r.status}`));
    const content = (j.choices?.[0]?.message?.content ?? "").replace(/^<think>[\s\S]*?<\/think>\s*/, "").trim();
    reply = { role: "assistant", content: content || "(empty answer)", at: new Date().toISOString(), model: used.id };
  } catch (e) {
    reply = { role: "assistant", content: `${used.id} did not answer: ${(e as Error).message.slice(0, 300)}`, at: new Date().toISOString(), model: used.id, error: true };
  }
  chat.messages.push(reply);
  chat.updatedAt = reply.at;
  await chats.write(all);
  return { chat, reply };
}
