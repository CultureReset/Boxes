import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sparkles, ArrowUp, Paperclip, ChevronUp, Mic, Square, Cpu, X, FileText, Image as ImageIcon } from "lucide-react";
import { api, useApi } from "../api/client";
import { useToast } from "../state/toast";
import { AgentsPopover } from "./AgentsPopover";
import type { AgentsInfo, Attachment, ChatModel } from "../api/types";
import { AGENT, store, toBase64, uploadFile, type Outgoing } from "../lib/chat";

/** Pick a recording format the browser can make: Chrome/Android webm, iPhone Safari mp4. */
function recorderMime(): string {
  const MR = window.MediaRecorder;
  if (!MR?.isTypeSupported) return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MR.isTypeSupported(t)) ?? "";
}

export function AskBar({ placeholder, personas, persona, onPersona, onJob, online, model, onModel, onChat }: {
  placeholder: string;
  personas?: AgentsInfo["personas"];
  persona: string;
  onPersona: (id: string) => void;
  onJob: (id: string) => void;
  online: boolean;
  /** "agent" = the agent/persona path; anything else is a model id for a plain chat. */
  model: string;
  onModel: (id: string) => void;
  onChat: (o: Outgoing) => void;
}) {
  const [text, setText] = useState("");
  const [busy] = useState(false);
  const [open, setOpen] = useState(false);
  const [pickModel, setPickModel] = useState(false);
  const [rec, setRec] = useState<"idle" | "recording" | "hearing">("idle");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const toast = useToast();
  const { data: models } = useApi<ChatModel[]>("/api/chat/models");
  const current = personas?.find((p) => p.id === persona);
  const chatMode = model !== AGENT;
  const modelInfo = models?.find((m) => m.id === model);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const dispatch = async (prompt: string) => {
    if ((!prompt && !files.length) || busy || uploading) return;
    // The bar IS the chat: every ask (a model, or Agent = Ask NODE) lands in the chat panel above it.
    const m = chatMode ? model : files.length ? (files.some((f) => f.kind === "image") ? "v4" : "fast") : AGENT;
    if (!chatMode && files.length) onModel(m);
    onChat({ text: prompt, model: m, attachments: files });
    setText("");
    setFiles([]);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void dispatch(text.trim());
  };

  const mic = async () => {
    if (rec === "recording") {
      recorder.current?.stop();
      return;
    }
    if (rec === "hearing") return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      // Phones only hand the mic to https pages. The box's https name is the
      // one tailscale serve uses for every service; borrow it from the registry.
      let host = location.hostname;
      try {
        const svc = await api.get<{ url?: string | null }[]>("/api/control");
        const u = svc.map((x) => x.url).find((x): x is string => Boolean(x && x.startsWith("https://")));
        if (u) host = new URL(u).hostname;
      } catch {
        /* keep the current host */
      }
      toast(`Voice needs the secure address: https://${host}:14443 (phones only allow the mic over https).`, "error");
      return;
    }
    if (!window.MediaRecorder) {
      toast("This browser can't record audio", "error");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast("Microphone permission was denied", "error");
      return;
    }
    const mime = recorderMime();
    const r = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRec("hearing");
      try {
        const blob = new Blob(chunks, { type: r.mimeType || mime || "audio/webm" });
        const { text: heard } = await api.post<{ text: string }>("/api/voice/transcribe", { audio: await toBase64(blob), mime: blob.type });
        if (!heard.trim()) toast("Didn't catch that", "info");
        else if (store.autoSend) void dispatch(heard.trim());
        else {
          setText((t) => (t ? `${t} ${heard.trim()}` : heard.trim()));
          document.querySelector<HTMLInputElement>(".askbar input")?.focus();
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not hear that", "error");
      } finally {
        setRec("idle");
      }
    };
    recorder.current = r;
    r.start();
    setRec("recording");
  };

  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    for (const f of Array.from(list)) {
      setUploading((n) => n + 1);
      try {
        const a = await uploadFile(f);
        setFiles((fs) => [...fs, a]);
      } catch (err) {
        toast(err instanceof Error ? err.message : `Could not upload ${f.name}`, "error");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const local = (models ?? []).filter((m) => !m.cloud);
  const cloud = (models ?? []).filter((m) => m.cloud);

  return (
    <div className="askbar-wrap">
      {(files.length > 0 || uploading > 0) && (
        <div className="ask-files">
          {files.map((f) => (
            <span key={f.id} className="ask-file">
              {f.kind === "image" ? <ImageIcon size={13} /> : <FileText size={13} />}
              <span className="n">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))}><X size={12} /></button>
            </span>
          ))}
          {uploading > 0 && <span className="ask-file"><span className="spinner" /> Uploading…</span>}
        </div>
      )}
      <form className="askbar" onSubmit={submit}>
        <Sparkles size={20} className="spark" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={rec === "recording" ? "Listening… tap ■ to stop" : rec === "hearing" ? "Hearing…" : chatMode ? `Message ${modelInfo?.id ?? model}` : placeholder} aria-label="Ask NODE" />
        <button type="button" className={`mic${rec !== "idle" ? " on" : ""}`} aria-label={rec === "recording" ? "Stop recording" : "Speak"} onClick={() => void mic()}>
          {rec === "recording" ? <Square size={16} /> : rec === "hearing" ? <span className="spinner" /> : <Mic size={18} />}
        </button>
        <button type="button" className="icon-btn" aria-label="Attach" onClick={() => fileInput.current?.click()}>
          <Paperclip size={18} />
        </button>
        <input ref={fileInput} type="file" multiple hidden accept="image/*,application/pdf,.pdf,text/*,.txt,.csv,.tsv,.md,.json,.log,.yaml,.yml" onChange={(e) => void attach(e.target.files)} data-testid="attach-input" />
        <button type="button" className="persona model-pick" aria-label="Model" aria-expanded={pickModel} onClick={() => { setPickModel((o) => !o); setOpen(false); }}>
          <Cpu size={14} /> <span className="mn">{chatMode ? model : "Agent"}</span>
        </button>
        {!chatMode && (
          <button ref={btn} type="button" className="persona" aria-label="Agents" aria-expanded={open} onClick={() => { setOpen((o) => !o); setPickModel(false); }}>
            <Sparkles size={14} /> <span>{current?.name ?? "Agents"}</span> <ChevronUp size={14} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform var(--fast)" }} />
          </button>
        )}
        <button type="submit" className={`send${text.trim() || files.length ? " ready" : ""}`} aria-label="Send" disabled={busy || uploading > 0}>
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
      {pickModel && (
        <div className="popover model-pop" role="listbox" aria-label="Choose a model" onMouseDown={(e) => e.stopPropagation()}>
          <button type="button" role="option" aria-selected={!chatMode} className={!chatMode ? "active" : ""} onClick={() => { onModel(AGENT); setPickModel(false); }}>
            <Sparkles size={14} /> <span className="grow">Agent</span> <small>Sends it to Paperclip (Lead)</small>
          </button>
          <div className="grp">Local · via LiteLLM</div>
          {local.map((m) => (
            <button key={m.id} type="button" role="option" aria-selected={model === m.id} className={model === m.id ? "active" : ""} onClick={() => { onModel(m.id); setPickModel(false); }}>
              <Cpu size={14} /> <span className="grow">{m.id}</span> {m.vision && <small>vision</small>}
            </button>
          ))}
          {cloud.length > 0 && <div className="grp">Cloud · LiteLLM</div>}
          {cloud.map((m) => (
            <button key={m.id} type="button" role="option" aria-selected={model === m.id} className={model === m.id ? "active" : ""} onClick={() => { onModel(m.id); setPickModel(false); }}>
              <Cpu size={14} /> <span className="grow">{m.id}</span> <small>cloud</small>
            </button>
          ))}
          {!models && <div className="grp">Loading models…</div>}
        </div>
      )}
      {open && btn.current && personas && <AgentsPopover anchor={btn.current.getBoundingClientRect()} personas={personas} onPick={(id) => { onPersona(id); document.querySelector<HTMLInputElement>(".askbar input")?.focus(); }} onClose={() => setOpen(false)} onJob={onJob} />}
    </div>
  );
}
