import { useEffect, useState, type FormEvent } from "react";
import { Sparkles, ArrowUp, ShieldCheck, Loader2 } from "lucide-react";
import { door } from "../lib/door";

/** Ask NODE: say what you want; NODE picks the backend, plans, runs reads, and files writes for your YES.
 *  Talks to node-door POST /intent (owner session) and polls GET /intent/<id> while an approval is open. */
interface Step { capability: string; backend: string; mode: "read" | "write"; summary?: string; status: string; tier?: number;
  request_id?: string; approve_url?: string; preview?: { title?: string; nodes?: string[]; flow?: string[]; message?: string; arguments?: string };
  result?: unknown; arguments?: unknown }
interface Intent { id: string; text: string; backends: string[]; answer: string; model: string; steps: Step[] }

const OPEN = new Set(["pending", "approved", "executing"]);
const LABEL: Record<string, string> = { pending: "Waiting for your YES", approved: "Approved — running", executing: "Running", executed: "Done",
  denied: "You said no", expired: "Expired", failed: "Failed", done: "Done", error: "Error", not_deployed: "Not live yet (setup-3)" };

export function AskNode() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [it, setIt] = useState<Intent | null>(null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    if (!it || !it.steps.some((s) => OPEN.has(s.status))) return;
    const t = setInterval(() => { fetch(`/door/intent/${it.id}`, { credentials: "include" }).then((r) => r.ok ? r.json() : null).then((x) => x && setIt(x)).catch(() => {}); }, 4000);
    return () => clearInterval(t);
  }, [it]);

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true); setErr(""); setIt(null);
    try { setIt(await door.post<Intent>("/intent", { text: text.trim() })); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }

  const box: React.CSSProperties = { background: "var(--glass, rgba(255,255,255,.06))", borderRadius: 16, padding: 16, margin: "12px 0" };
  return (
    <section style={box} aria-label="Ask NODE">
      <form onSubmit={ask} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Sparkles size={20} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask NODE: “create me a workflow…”, “what’s down?”, “have an agent research…”"
          aria-label="Ask NODE" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "inherit", fontSize: 16, padding: 8 }} />
        <button type="submit" disabled={busy} aria-label="Ask" className="pill">{busy ? <Loader2 size={16} className="spin" /> : <ArrowUp size={16} />}</button>
      </form>
      {busy && <div style={{ opacity: .7, marginTop: 8 }}>Finding the right backend and planning…</div>}
      {err && <div style={{ color: "var(--danger, #f66)", marginTop: 8 }}>{err}</div>}
      {it && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, opacity: .75 }}>Backend: <b>{it.backends.join(", ") || "none"}</b> · model {it.model}</div>
          {it.steps.map((s, i) => (
            <div key={i} style={{ borderLeft: `3px solid ${s.mode === "write" ? "#e9a23b" : "#4caf80"}`, paddingLeft: 10 }}>
              <div><b>{i + 1}. {s.mode === "write" ? "Change" : "Read"}</b> · {s.backend} · <code>{s.capability.replace(/^(gw|mcp):/, "")}</code> — <span className="pill">{LABEL[s.status] ?? s.status}</span></div>
              {s.summary && <div style={{ opacity: .85 }}>{s.summary}</div>}
              {s.preview && (
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  <div>{s.preview.title}</div>
                  {s.preview.nodes && <ul style={{ margin: "4px 0 0 18px" }}>{s.preview.nodes.map((n) => <li key={n}>{n}</li>)}</ul>}
                  {s.preview.flow && <div style={{ opacity: .7 }}>Flow: {s.preview.flow.join(" · ")}</div>}
                  {s.preview.message && <div style={{ opacity: .85 }}>“{s.preview.message}”</div>}
                  {s.arguments != null && <button type="button" className="pill" style={{ marginTop: 4 }} onClick={() => setShowJson(!showJson)}>{showJson ? "Hide" : "Show"} exact JSON</button>}
                  {showJson && s.arguments != null && <pre style={{ maxHeight: 220, overflow: "auto", fontSize: 12 }}>{JSON.stringify(s.arguments, null, 2)}</pre>}
                </div>
              )}
              {s.status === "pending" && s.approve_url && (
                <a href={s.approve_url} style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 6 }}><ShieldCheck size={16} /> Approve or decline (tier {s.tier})</a>
              )}
              {s.result != null && s.mode === "write" && <div style={{ fontSize: 13, opacity: .8 }}>{typeof s.result === "string" ? s.result : (s.result as { out?: string }).out}</div>}
            </div>
          ))}
          {it.answer && <div style={{ whiteSpace: "pre-wrap" }}>{it.answer}</div>}
        </div>
      )}
    </section>
  );
}
