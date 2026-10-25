import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUp, History, Plus, Trash2, Mic, Sparkles } from "lucide-react";
import { api, useApi } from "../api/client";
import type { Job } from "../api/types";
import { Markdown } from "../lib/markdown";
import { navigate } from "../lib/router";
import { useToast } from "../state/toast";

interface Msg { role: "user" | "assistant"; content: string; at: string; model?: string; provider?: string; failed?: boolean }
interface Chat { id: string; title: string; createdAt: string; updatedAt: string; model?: string; provider?: string; messages: Msg[]; pendingJob?: string }
type ChatSummary = Omit<Chat, "messages"> & { count: number };

export async function startChat(text: string, persona?: string): Promise<string> {
  const r = await api.post<{ chat: Chat; jobId: string }>("/api/chats/send", { text, model: localStorage.getItem("node.model") || undefined, provider: localStorage.getItem("node.provider") || "", persona });
  return r.chat.id;
}

/** ChatGPT-style full-screen conversation, persisted by the daemon. */
export function ChatView({ id, showHistory }: { id: string; showHistory: boolean }) {
  const isNew = id === "new";
  const [chat, setChat] = useState<Chat | null>(null);
  const [live, setLive] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: llm } = useApi<{ models: string[]; default: string }>("/api/llm/models", []);
  const { data: agents } = useApi<{ providers: { id: string; name: string; installed: boolean; isDefault: boolean }[] }>("/api/agents", []);
  const [model, setModel] = useState(() => localStorage.getItem("node.model") ?? "");
  const [provider, setProvider] = useState(() => localStorage.getItem("node.provider") ?? "");
  const end = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    if (isNew) { setChat(null); return; }
    try {
      const c = await api.get<Chat>(`/api/chats/${id}`);
      setChat(c);
      if (c.model) setModel(c.model);
      if (c.provider !== undefined) setProvider(c.provider ?? "");
    } catch { toast("That chat is gone", "error"); navigate("chat", "new"); }
  }, [id, isNew, toast]);
  useEffect(() => { void load(); }, [load]);

  // Stream the pending reply by polling its job, then reload the saved chat.
  useEffect(() => {
    if (!chat?.pendingJob) { setLive(""); return; }
    let stop = false;
    const tick = async () => {
      while (!stop) {
        const j = await api.get<Job>(`/api/jobs/${chat.pendingJob}`).catch(() => null);
        if (stop) return;
        setLive(j?.lines.join("\n") ?? "");
        if (!j || j.status !== "running") { await new Promise((r) => setTimeout(r, 700)); if (!stop) void load(); return; }
        await new Promise((r) => setTimeout(r, 450));
      }
    };
    void tick();
    return () => { stop = true; };
  }, [chat?.pendingJob, load]);

  useEffect(() => {
    const el = end.current?.parentElement; if (!el) return;
    const go = () => { el.scrollTop = el.scrollHeight; };
    go(); requestAnimationFrame(go); const t = setTimeout(go, 250);
    return () => clearTimeout(t);
  }, [chat?.id, chat?.messages.length, live]);
  useEffect(() => {
    const el = ta.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 150) + "px";
  }, [text]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t || busy || chat?.pendingJob) return;
    setBusy(true);
    try {
      if (model) localStorage.setItem("node.model", model);
      const r = await api.post<{ chat: Chat; jobId: string }>("/api/chats/send", { id: isNew ? undefined : id, text: t, model: model || undefined, provider });
      setText("");
      setChat(r.chat);
      if (isNew) navigate("chat", r.chat.id);
    } catch (err) { toast(err instanceof Error ? err.message : "Could not send", "error"); }
    finally { setBusy(false); }
  };

  const pending = Boolean(chat?.pendingJob);
  const engines = (agents?.providers ?? []).filter((p) => p.installed);

  return (
    <div className="chatview">
      <header className="cv-top">
        <button type="button" className="cv-btn" aria-label="Back" onClick={() => navigate("home")}><ArrowLeft size={20} /></button>
        <div className="cv-title">{chat?.title ?? "New chat"}</div>
        <button type="button" className="cv-btn" aria-label="History" onClick={() => navigate("chat", id, { history: "1" })}><History size={20} /></button>
        <button type="button" className="cv-btn" aria-label="New chat" onClick={() => navigate("chat", "new")}><Plus size={20} /></button>
      </header>
      <div className="cv-thread">
        {!chat?.messages.length && !pending && <div className="cv-empty"><Sparkles size={28} /><p>Ask anything. Your chats are saved on NODE.</p></div>}
        {chat?.messages.map((m, i) => (
          <div key={i} className={`cv-msg ${m.role}${m.failed ? " failed" : ""}`}>
            {m.role === "assistant" ? <Markdown text={m.content} /> : <div className="md"><p>{m.content}</p></div>}
            {m.role === "assistant" && m.model && <div className="cv-meta">{m.provider && m.provider !== "local" ? m.provider : m.model}</div>}
          </div>
        ))}
        {pending && <div className="cv-msg assistant">{live ? <Markdown text={live} /> : <div className="typing"><span /><span /><span /></div>}</div>}
        <div ref={end} />
      </div>
      <form className="cv-input" onSubmit={send}>
        <textarea ref={ta} rows={1} value={text} placeholder="Message NODE" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) { e.preventDefault(); void send(); } }} />
        <div className="cv-tools">
          <select aria-label="Engine" value={provider} onChange={(e) => { setProvider(e.target.value); e.target.value ? localStorage.setItem("node.provider", e.target.value) : localStorage.removeItem("node.provider"); }}>
            <option value="">Default engine</option>
            {engines.map((p) => <option key={p.id} value={p.id}>{p.id === "local" ? "Local" : p.name}</option>)}
          </select>
          <select aria-label="Model" value={model || llm?.default || ""} onChange={(e) => setModel(e.target.value)}>
            {(llm?.models.length ? llm.models : [llm?.default ?? "fast"]).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button type="button" className="cv-btn" aria-label="Speak" onClick={() => toast("Use the keyboard mic on iPhone", "info")}><Mic size={18} /></button>
          <button type="submit" className={`cv-send${text.trim() ? " ready" : ""}`} aria-label="Send" disabled={busy || pending}>{busy ? <span className="spinner" /> : <ArrowUp size={20} />}</button>
        </div>
      </form>
      {showHistory && <ChatHistory current={id} />}
    </div>
  );
}

function ChatHistory({ current }: { current: string }) {
  const [items, setItems] = useState<ChatSummary[] | null>(null);
  const reload = () => void api.get<ChatSummary[]>("/api/chats").then(setItems);
  useEffect(reload, []);
  const close = () => navigate("chat", current);
  return (
    <div className="cv-history" onClick={close}>
      <div className="cv-hpanel" onClick={(e) => e.stopPropagation()}>
        <div className="cv-hhead"><b>Chats</b><button type="button" className="btn sm" onClick={() => navigate("chat", "new")}><Plus size={14} /> New chat</button></div>
        {items?.length === 0 && <p className="tiny" style={{ padding: 16 }}>No chats yet.</p>}
        {items?.map((c) => (
          <div key={c.id} className={`cv-hrow${c.id === current ? " on" : ""}`}>
            <button type="button" className="cv-hopen" onClick={() => navigate("chat", c.id)}>
              <span className="t">{c.title || "Untitled"}</span>
              <span className="s">{new Date(c.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {c.count} messages</span>
            </button>
            <button type="button" className="cv-btn" aria-label="Delete chat" onClick={() => { if (window.confirm(`Delete “${c.title}”? This can't be undone.`)) void api.del(`/api/chats/${c.id}`).then(() => { if (c.id === current) navigate("chat", "new"); reload(); }); }}><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
