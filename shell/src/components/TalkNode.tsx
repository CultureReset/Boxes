import { logTalk } from "../lib/chat";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { DOOR } from "../lib/door";

/** Talk to NODE: live spoken conversation with Grok realtime voice.
 *  The door (owner session) mints a 2-minute xAI client secret + the shared node-voice session config;
 *  the phone connects straight to wss://api.x.ai (the API key never leaves the PC). Tools run on the PC via /door/voice/tool.
 *  iOS: mic + AudioContext start inside the tap; mic is resampled to 24 kHz PCM16; replies are 24 kHz PCM16. */
type State = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
const RATE = 24000;
interface Line { role: "you" | "node" | "sys"; text: string }

async function post<T>(p: string, b: unknown): Promise<T> {
  const r = await fetch(DOOR + p, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? String(r.status));
  return d as T;
}
function toB64(i16: Int16Array) { let s = ""; const u = new Uint8Array(i16.buffer); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); }
function fromB64(b: string) { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Int16Array(u.buffer); }

export function TalkNode() {
  const [state, setState] = useState<State>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [left, setLeft] = useState(0);
  const [err, setErr] = useState("");
  const r = useRef<{ ws?: WebSocket; ctx?: AudioContext; stream?: MediaStream; proc?: ScriptProcessorNode; sid?: string; playAt: number;
    srcs: AudioBufferSourceNode[]; timer?: number; stop?: () => void }>({ playAt: 0, srcs: [] });
  const add = (l: Line) => setLines((x) => [...x.slice(-30), l]);
  useEffect(() => () => r.current.stop?.(), []);

  async function start() {
    setErr(""); setLines([]); setState("connecting");
    const R = r.current;
    try {
      // 1) inside the tap: mic permission + AudioContext (iOS needs both from a user gesture)
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      await ctx.resume(); R.ctx = ctx;
      const streamP = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const cfgP = post<{ session_id: string; secret: string; ws_url: string; session: unknown; max_seconds: number; filler_after: number; filler: string }>("/voice/session", {});
      const [stream, cfg] = await Promise.all([streamP, cfgP]);
      R.stream = stream; R.sid = cfg.session_id;
      const log = (role: string, text: string) => { if (role === "user" || role === "assistant") logTalk(role, text); if (text) post("/voice/log", { session_id: cfg.session_id, role, text }).catch(() => {}); };

      // 2) straight to xAI with the ephemeral secret
      const ws = new WebSocket(cfg.ws_url, [`xai-client-secret.${cfg.secret}`]); R.ws = ws;
      const early: string[] = [];
      const send = (o: unknown) => ws.readyState === 1 && ws.send(JSON.stringify(o));
      const stopPlayback = () => { R.srcs.forEach((s) => { try { s.stop(); } catch { /* done */ } }); R.srcs = []; R.playAt = 0; };
      const playing = () => R.srcs.length > 0;
      const waitIdle = async () => { for (let i = 0; i < 100 && playing(); i++) await new Promise((z) => setTimeout(z, 100)); };

      // mic -> 24 kHz PCM16 (linear resample from the device rate)
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(4096, 1, 1); R.proc = proc;
      const mute = ctx.createGain(); mute.gain.value = 0;
      src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
      const ratio = ctx.sampleRate / RATE;
      proc.onaudioprocess = (e) => {
        const inp = e.inputBuffer.getChannelData(0); const n = Math.floor(inp.length / ratio); const o = new Int16Array(n);
        for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, inp[Math.floor(i * ratio)])); o[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
        const b = toB64(o);
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b })); else if (early.length < 40) early.push(b);
      };

      const pending = new Set<string>();
      const pollChange = (id: string) => {
        if (pending.has(id)) return; pending.add(id); let n = 0;
        const t = window.setInterval(async () => {
          if (++n > 60 || ws.readyState !== 1) { clearInterval(t); return; }
          const out = await post<{ open?: boolean; steps?: { status: string }[]; answer?: string }>("/voice/tool", { session_id: cfg.session_id, name: "check_change", args: { intent_id: id } }).catch(() => null);
          if (out && out.open === false) {
            clearInterval(t); await waitIdle();
            send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text",
              text: `[NODE update, not Matt speaking] The change you filed is now: ${(out.steps ?? []).map((s) => s.status).join(", ")}. ${out.answer ?? ""} Tell Matt the result in one sentence.` }] } });
            send({ type: "response.create" });
          }
        }, 5000);
      };

      ws.onopen = () => {
        send({ type: "session.update", session: cfg.session });
        early.splice(0).forEach((a) => send({ type: "input_audio_buffer.append", audio: a }));
        setState("listening"); add({ role: "sys", text: "Connected — talk any time. Interrupt whenever you like." });
      };
      ws.onmessage = async (m) => {
        const ev = JSON.parse(m.data as string);
        switch (ev.type) {
          case "input_audio_buffer.speech_started": stopPlayback(); setState("listening"); break;   // barge-in
          case "input_audio_buffer.speech_stopped": setState("thinking"); break;
          case "response.output_audio.delta": case "response.audio.delta": {
            const pcm = fromB64(ev.delta); const buf = ctx.createBuffer(1, pcm.length, RATE); const ch = buf.getChannelData(0);
            for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
            const s = ctx.createBufferSource(); s.buffer = buf; s.connect(ctx.destination);
            const at = Math.max(ctx.currentTime + 0.02, R.playAt); s.start(at); R.playAt = at + buf.duration; R.srcs.push(s);
            s.onended = () => { R.srcs = R.srcs.filter((x) => x !== s); if (!R.srcs.length) setState((st) => (st === "speaking" ? "listening" : st)); };
            setState("speaking"); break;
          }
          case "conversation.item.input_audio_transcription.completed": add({ role: "you", text: ev.transcript }); log("user", ev.transcript); break;
          case "response.output_audio_transcript.done": case "response.audio_transcript.done": add({ role: "node", text: ev.transcript }); log("assistant", ev.transcript); break;
          case "response.function_call_arguments.done": {
            setState("thinking");
            const args = JSON.parse(ev.arguments || "{}");
            add({ role: "sys", text: `${ev.name === "request_change" ? "Filing change" : "Asking NODE"}: ${args.text ?? args.intent ?? ""}` });
            let done = false;
            const filler = window.setTimeout(() => { if (!done && !playing()) send({ type: "conversation.item.create", item: { type: "force_message", role: "assistant", content: [{ type: "output_text", text: cfg.filler }] } }); }, cfg.filler_after * 1000);
            const out = await post<Record<string, unknown>>("/voice/tool", { session_id: cfg.session_id, name: ev.name, args }).catch((x): Record<string, unknown> => ({ error: (x as Error).message }));
            done = true; clearTimeout(filler);
            send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: ev.call_id, output: JSON.stringify(out) } });
            await waitIdle(); send({ type: "response.create" });
            if (ev.name === "request_change" && out.status === "pending" && out.intent_id) { add({ role: "sys", text: "Approval texted — reply YES + your code." }); pollChange(String(out.intent_id)); }
            break;
          }
          case "error": add({ role: "sys", text: "xAI: " + (ev.error?.message ?? "error") }); break;
        }
      };
      ws.onclose = () => R.stop?.();
      ws.onerror = () => { setErr("voice connection failed"); };

      const end = Date.now() + cfg.max_seconds * 1000;   // 10-minute cap
      R.timer = window.setInterval(() => { const s = Math.round((end - Date.now()) / 1000); setLeft(s); if (s <= 0) R.stop?.(); }, 1000);
      R.stop = () => {
        clearInterval(R.timer); stopPlayback(); try { R.proc?.disconnect(); } catch { /* */ }
        R.stream?.getTracks().forEach((t) => t.stop()); if (R.ws && R.ws.readyState < 2) R.ws.close();
        R.ctx?.close().catch(() => {}); R.stop = undefined; setState((s) => (s === "error" ? s : "idle"));
        log("system", "session end");
      };
    } catch (x) { setErr((x as Error).message); setState("error"); r.current.stop?.(); }
  }

  const on = state !== "idle" && state !== "error";
  const label: Record<State, string> = { idle: "Talk to NODE", connecting: "Connecting…", listening: "Listening", thinking: "Thinking…", speaking: "Speaking", error: "Talk to NODE" };
  const color = { listening: "#4caf80", thinking: "#e9a23b", speaking: "#5b8cff", connecting: "#888" } as Record<string, string>;
  return (
    <section aria-label="Talk to NODE" style={{ background: "var(--glass, rgba(255,255,255,.06))", borderRadius: 16, padding: 16, margin: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" className="pill" onClick={() => (on ? r.current.stop?.() : start())} aria-pressed={on}
          style={{ display: "inline-flex", gap: 8, alignItems: "center", padding: "12px 18px", fontSize: 16, background: on ? color[state] : undefined }}>
          {state === "connecting" ? <Loader2 size={18} className="spin" /> : on ? <Square size={18} /> : <Mic size={18} />}
          {on ? `${label[state]} · tap to end` : label[state]}
        </button>
        {on && left > 0 && <span style={{ opacity: .6, fontSize: 13 }}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left</span>}
      </div>
      {err && <div style={{ color: "var(--danger, #f66)", marginTop: 8 }}>{err}</div>}
      {lines.length > 0 && (
        <div style={{ marginTop: 10, display: "grid", gap: 4, fontSize: 14, maxHeight: 220, overflow: "auto" }}>
          {lines.map((l, i) => <div key={i} style={{ opacity: l.role === "sys" ? .6 : 1 }}><b>{l.role === "you" ? "You" : l.role === "node" ? "NODE" : "·"}</b> {l.text}</div>)}
        </div>
      )}
    </section>
  );
}
