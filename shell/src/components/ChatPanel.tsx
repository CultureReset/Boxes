import { useEffect, useRef, useState } from "react";
import { X, Plus, History, FileText, Trash2, Send } from "lucide-react";
import type { Job } from "../api/types";
import { api } from "../api/client";
import type { Chat, ChatMessage, ChatSummary } from "../api/types";
import { sendChat, store, type Outgoing } from "../lib/chat";
import { useToast } from "../state/toast";

/**
 * A conversation with one model. Sits under the ask bar so the same full-width
 * bar keeps the conversation going. History lives on the box (chats.json).
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
  const sent = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const loadList = () => void api.get<ChatSummary[]>("/api/chats").then(setList).catch(() => setList([]));
  useEffect(loadList, []);

  useEffect(() => {
    if (!chatId) { setChat(null); return; }
    if (chat?.id === chatId) return;
    void api.get<Chat>(`/api/chats/${chatId}`).then((c) => { setChat(c); onModel(c.model); }).catch(() => { setChat(null); onChatId(null); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    if (!outgoing || outgoing.n === sent.current) return;
    sent.current = outgoing.n;
    setShowList(false);
    const mine: ChatMessage = { role: "user", content: outgoing.text, at: new Date().toISOString(), attachments: outgoing.attachments };
    setPending([mine, { role: "assistant", content: "", at: "", model: outgoing.model, pending: true }]);
    void sendChat(chat?.id ?? chatId, outgoing)
      .then(({ chat: c }) => { setChat(c); onChatId(c.id); loadList(); })
      .catch((e) => toast(e instanceof Error ? e.message : "Send failed", "error"))
      .finally(() => setPending([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoing]);

  useEffect(() => {
    // Braces matter: newer Chrome returns a Promise here, and React would call it as a cleanup.
    end.current?.scrollIntoView({ block: "end" });
  }, [chat, pending]);

  const messages = [...(chat?.messages ?? []), ...pending];
  return (
    <section className="chatpanel" aria-label="Chat">
      <header className="chat-head">
        <button type="button" className="icon-btn" aria-label="Chat history" onClick={() => { setShowList((s) => !s); loadList(); }}><History size={18} /></button>
        <div className="grow t">{showList ? "Chats" : (chat?.title ?? (pending.length ? pending[0].content.slice(0, 40) || "New chat" : "New chat"))}</div>
        {chat?.id && !showList && onJob && (
          <button type="button" className="icon-btn" aria-label="Send to Paperclip" title="Send this chat to Paperclip as a task for Lead"
            onClick={() => void api.post<Job>(`/api/chats/${chat.id}/paperclip`, {}).then((j) => { onJob(j.id); toast("Sent to Paperclip (Lead)"); }).catch((e) => toast(e instanceof Error ? e.message : "Paperclip failed", "error"))}>
            <Send size={18} />
          </button>
        )}
        <button type="button" className="icon-btn" aria-label="New chat" onClick={() => { setChat(null); onChatId(null); setShowList(false); }}><Plus size={18} /></button>
        <button type="button" className="icon-btn" aria-label="Close chat" onClick={onClose}><X size={18} /></button>
      </header>
      {showList ? (
        <div className="chat-list">
          {list?.length === 0 && <p className="muted">No chats yet. Pick a model in the bar below and ask something.</p>}
          {list?.map((c) => (
            <div key={c.id} className="chat-row">
              <button type="button" className="grow" onClick={() => { onChatId(c.id); setShowList(false); }}>
                <b>{c.title}</b>
                <small>{c.model} · {c.count} messages · {new Date(c.updatedAt).toLocaleString()}</small>
              </button>
              <button type="button" className="icon-btn" aria-label={`Delete ${c.title}`} onClick={() => void api.del(`/api/chats/${c.id}`).then(() => { if (c.id === chat?.id) { setChat(null); onChatId(null); } loadList(); })}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="chat-msgs">
          {messages.length === 0 && <p className="muted">New chat. Your choice of model is remembered for this chat.</p>}
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
              {m.pending ? <div className="bubble"><span className="spinner" /> {m.model} is thinking…</div> : m.content && <div className="bubble">{m.content}</div>}
              {m.role === "assistant" && !m.pending && m.model && <small className="by">{m.model}</small>}
            </div>
          ))}
          <div ref={end} />
        </div>
      )}
    </section>
  );
}

export { store };
