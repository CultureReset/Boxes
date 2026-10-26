import { api } from "../api/client";
import type { Attachment, Chat, ChatMessage } from "../api/types";

/** The chat being shown, and the model last picked. Both survive a reload. */
export const AGENT = "agent";
export const store = {
  get chat(): string | null { return localStorage.getItem("node.chat"); },
  set chat(v: string | null) { v ? localStorage.setItem("node.chat", v) : localStorage.removeItem("node.chat"); },
  get model(): string { return localStorage.getItem("node.model") ?? AGENT; },
  set model(v: string) { localStorage.setItem("node.model", v); },
  get autoSend(): boolean { return localStorage.getItem("node.voiceAutoSend") === "1"; },
};

export interface Outgoing { text: string; model: string; attachments: Attachment[] }

export function sendChat(chat: string | null, o: Outgoing): Promise<{ chat: Chat; reply: ChatMessage }> {
  return api.post("/api/chat/send", { chat, text: o.text, model: o.model, attachments: o.attachments.map((a) => a.id) });
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
