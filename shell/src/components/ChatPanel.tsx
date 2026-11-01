import { useEffect, useRef, useState } from "react";
import { X, Plus, History, FileText, Trash2, Send, Copy, Volume2, Maximize2, Minimize2, Pencil, Search, Phone } from "lucide-react";
import type { Job } from "../api/types";
import { api } from "../api/client";
import type { Chat, ChatMessage, ChatSummary } from "../api/types";
import { AGENT, askAgent, store, streamChat, type Outgoing } from "../lib/chat";
import { Markdown } from "./Markdown";
import { useToast } from "../state/toast";

/**
 * The bottom bar's conversation. Slides up over the current page; expands to a
 * full chat screen with past chats (search, rename, delete). History lives on
 * the PC (daemon chats.json). Model replies stream; Agent asks go to Ask NODE.
 */
export function ChatPanel({ chatId, outgoing, onChatId, onModel, onClose, onJob }: {
  onJob?: (id: string) => void;
  chatId: string | null;
  outgoing: (Outgoing & { n: number }) | null;
  onChatId: (id: string | null) => void;
  onModel: (m: string) => void;
  onClose: () => void;
}) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [list, setList] = useState<ChatSummary[] | null>(null);
  const [showList, setShowList] = useState(!chatId && !outgoing);
  const [full, setFull] = useState(() => localStorage.getItem("node.chatFull") === "1");
  const [q, setQ] = useState("");
  const [speak, setSpeak] = useState(() => localStorage.getItem("node.readAloud") === "1");
  const sent = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const loadList = (query = q) => void api.get<ChatSummary[]>(`/api/chats${query ? `?q=${encodeURIComponent(query)}` : ""}`).then(setList).catch(() => setList([]));
  useEffect(() => loadList(), []);
  useEffect(() => { const t = setTimeout(() => loadList(q), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { localStorage.setItem("node.chatFull", full ? "1" : "0"); }, [full]);
  useEffect(() => { localStorage.setItem("node.readAloud", speak ? "1" : "0"); if (!speak) speechSynthesis?.cancel(); }, [speak]);

  useEffect(() => {
    if (!chatId) { setChat(null); return; }
    if (chat?.id === chatId) return;
    void api.get<Chat>(`/api/chats/${chatId}`).then((c) => { setChat(c); if (c.model !== "talk") onModel(c.model); }).catch(() => { setChat(null); onChatId(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const say = (t: string) => {
    if (!speak || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(t.replace(/[*#`_>[\]()]/g, "").slice(0, 2000)));
  };

  useEffect(() => {
    if (!outgoing || outgoing.n === sent.current) return;
    sent.current = outgoing.n;
    setShowList(false);
    const mine: ChatMessage = { role: "user", content: outgoing.text, at: new Date().toISOString(), attachments: outgoing.attachments };
    const label = outgoing.model === AGENT ? "NODE" : outgoing.model;
    setPending([mine, { role: "assistant", content: "", at: "", model: label, pending: true }]);
    const cid = chat?.id ?? chatId;
    const p = outgoing.model === AGENT
      ? askAgent(cid, outgoing.text)
      : streamChat(cid, outgoing, (t) => setPending((x) => x.length === 2 ? [x[0], { ...x[1], pending: false, content: x[1].content + t }] : x));
    void p.then(({ chat: c, reply }) => { setChat(c); onChatId(c.id); loadList(); say(reply.content); })
      .catch((e) => setPending((x) => [x[0], { role: "assistant", content: e instanceof Error ? e.message : "Send failed", at: "", model: label, error: true }]))
      .finally(() => setPending((x) => (x.some((m) => m.error) ? x : [])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoing]);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [chat, pending]);

  const rename = (id: string, cur: string) => {
    const t = prompt("Rename chat", cur);
    if (t && t.trim()) void api.post<Chat>(`/api/chats/${id}/rename`, { title: t.trim() }).then((c) => { if (chat?.id === c.id) setChat(c); loadList(); }).catch(() => toast("Rename failed", "error"));
  };
  const copy = (t: string) => void navigator.clipboard?.writeText(t).then(() => toast("Copied")).catch(() => toast("Copy failed", "error"));

  const messages = [...(chat?.messages ?? []), ...pending];
  return (
    <section className={`chatpanel${full ? " full" : " sheet"}`} aria-label="Chat">
      <header className="chat-head">
        <button type="button" className="icon-btn" aria-label="Chat history" onClick={() => { setShowList((s) => !s); setFull(true); loadList(); }}><History size={18} /></button>
        <div className="grow t" onDoubleClick={() => chat && rename(chat.id, chat.title)}>{showList ? "Chats" : (chat?.title ?? (pending.length ? pending[0].content.slice(0, 40) || "New chat" : "New chat"))}</div>
        {chat?.id && !showList && <button type="button" className="icon-btn" aria-label="Rename chat" onClick={() => rename(chat.id, chat.title)}><Pencil size={16} /></button>}
        <button type="button" className={`icon-btn${speak ? " on" : ""}`} aria-label="Read replies aloud" aria-pressed={speak} title="Read replies aloud" onClick={() => setSpeak((s) => !s)}><Volume2 size={17} /></button>
        <a className="icon-btn" href="/door/pccall/" aria-label="Call my computer (talk to the PC's voice mode)" title="Call my computer: your phone mic becomes the PC microphone, the PC speaker plays here"><Phone size={17} /></a>
        {chat?.id && !showList && onJob && (
          <button type="button" className="icon-btn" aria-label="Send to Paperclip" title="Send this chat to Paperclip as a task for Lead"
            onClick={() => void api.post<Job>(`/api/chats/${chat.id}/paperclip`, {}).then((j) => { onJob(j.id); toast("Sent to Paperclip (Lead)"); }).catch((e) => toast(e instanceof Error ? e.message : "Paperclip failed", "error"))}>
            <Send size={18} />
          </button>
        )}
        <button type="button" className="icon-btn" aria-label="New chat" onClick={() => { setChat(null); onChatId(null); setShowList(false); setPending([]); }}><Plus size={18} /></button>
        <button type="button" className="icon-btn" aria-label={full ? "Shrink chat" : "Expand chat"} onClick={() => setFull((f) => !f)}>{full ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
        <button type="button" className="icon-btn" aria-label="Close chat" onClick={onClose}><X size={18} /></button>
      </header>
      {showList ? (
        <div className="chat-list">
          <label className="chat-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" aria-label="Search chats" /></label>
          {list?.length === 0 && <p className="muted">{q ? "No chats match." : "No chats yet. Ask something in the bar below."}</p>}
          {list?.map((c) => (
            <div key={c.id} className="chat-row">
              <button type="button" className="grow" onClick={() => { onChatId(c.id); setShowList(false); }}>
                <b>{c.title}</b>
                <small>{c.model} · {c.count} messages · {new Date(c.updatedAt).toLocaleString()}</small>
              </button>
              <button type="button" className="icon-btn" aria-label={`Rename ${c.title}`} onClick={() => rename(c.id, c.title)}><Pencil size={14} /></button>
              <button type="button" className="icon-btn" aria-label={`Delete ${c.title}`} onClick={() => { if (confirm(`Delete "${c.title}"?`)) void api.del(`/api/chats/${c.id}`).then(() => { if (c.id === chat?.id) { setChat(null); onChatId(null); } loadList(); }); }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="chat-msgs">
          {messages.length === 0 && <p className="muted">New chat. Pick Agent (Ask NODE) or any model in the bar; you can switch mid-conversation.</p>}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}${m.error ? " err" : ""}`}>
              {m.attachments?.length ? (
                <div className="atts">
                  {m.attachments.map((a) =>
                    a.kind === "image" ? (
                      <a key={a.id} href={`/api/chat/upload/${a.id}`} target="_blank" rel="noreferrer"><img src={`/api/chat/upload/${a.id}`} alt={a.name} /></a>
                    ) : (
                      <a key={a.id} className="att" href={`/api/chat/upload/${a.id}`} target="_blank" rel="noreferrer"><FileText size={13} /> {a.name}</a>
                    ),
                  )}
                </div>
              ) : null}
              {m.pending ? <div className="bubble"><span className="spinner" /> {m.model} is thinking…</div>
                : m.content && <div className="bubble">{m.role === "assistant" ? <Markdown text={m.content} /> : m.content}</div>}
              {m.role === "assistant" && !m.pending && (
                <small className="by">
                  {m.model}
                  {m.content && <button type="button" className="icon-btn mini" aria-label="Copy reply" onClick={() => copy(m.content)}><Copy size={12} /></button>}
                  {m.content && "speechSynthesis" in window && <button type="button" className="icon-btn mini" aria-label="Read aloud" onClick={() => { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(m.content.replace(/[*#`_>[\]()]/g, "").slice(0, 2000))); }}><Volume2 size={12} /></button>}
                </small>
              )}
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
    </section>
  );
}

export { store };
