import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sparkles, ArrowUp, Paperclip, ChevronUp, Mic } from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../state/toast";
import { AgentsPopover } from "./AgentsPopover";
import type { AgentsInfo, Job } from "../api/types";

/** Minimal typing for the browser speech API, which is not in lib.dom for all targets. */
interface SpeechRec extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export function AskBar({ placeholder, personas, persona, onPersona, onJob, online }: { placeholder: string; personas?: AgentsInfo["personas"]; persona: string; onPersona: (id: string) => void; onJob: (id: string) => void; online: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const rec = useRef<SpeechRec | null>(null);
  const toast = useToast();
  const current = personas?.find((p) => p.id === persona);

  useEffect(() => () => rec.current?.stop(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const prompt = text.trim();
    if (!prompt || busy) return;
    setBusy(true);
    try {
      const job = await api.post<Job>("/api/agents/ask", { prompt, persona });
      setText("");
      onJob(job.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not reach NODE", "error");
    } finally {
      setBusy(false);
    }
  };

  const mic = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!Ctor) {
      toast("Voice input isn't available in this browser", "info");
      return;
    }
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (ev) => setText(Array.from(ev.results).map((res) => res[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); toast("Didn't catch that", "info"); };
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div className="askbar-wrap">
      <form className="askbar" onSubmit={submit}>
        <Sparkles size={20} className="spark" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? "Listening…" : placeholder} aria-label="Ask NODE" />
        <button type="button" className={`mic${listening ? " on" : ""}`} aria-label="Speak" onClick={mic}><Mic size={18} /></button>
        <button type="button" className="icon-btn" aria-label="Attach" onClick={() => toast("Mention a path like ~/Documents/report.pdf", "info")}>
          <Paperclip size={18} />
        </button>
        <button ref={btn} type="button" className="persona" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Sparkles size={14} /> <span>{current?.name ?? "Agents"}</span> <ChevronUp size={14} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform var(--fast)" }} />
        </button>
        <button type="submit" className={`send${text.trim() ? " ready" : ""}`} aria-label="Send" disabled={busy}>
          {busy ? <span className="spinner" /> : <ArrowUp size={18} />}
        </button>
      </form>
      <div className="askbar-foot" style={{ width: "min(100%, 1120px)", margin: "10px auto 0" }}>
        <span className="brand">
          <b>NODE</b>
          <span>Your AI computer, everywhere.</span>
        </span>
        <span className="online">
          <span className={`status-dot ${online ? "on" : "alert"}`} />
          {online ? "All systems online" : "Reconnecting…"}
        </span>
      </div>
      {open && btn.current && personas && <AgentsPopover anchor={btn.current.getBoundingClientRect()} personas={personas} onPick={(id) => { onPersona(id); document.querySelector<HTMLInputElement>(".askbar input")?.focus(); }} onClose={() => setOpen(false)} onJob={onJob} />}
    </div>
  );
}
