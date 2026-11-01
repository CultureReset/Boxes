import { useEffect, useState } from "react";
import { ChevronLeft, RotateCw, Monitor, Smartphone } from "lucide-react";
import type { AppViewTarget } from "../lib/openApp";

/** The in-app view: a web app in a frame, or the live stream of a desktop window. */
export function AppView() {
  const [t, setT] = useState<AppViewTarget | null>(null);
  const [n, setN] = useState(0);
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const on = (e: Event) => { setT((e as CustomEvent<AppViewTarget>).detail); setN((x) => x + 1); setDesk(false); };
    window.addEventListener("node:app-view", on);
    return () => window.removeEventListener("node:app-view", on);
  }, []);
  useEffect(() => {
    if (!t) return;
    // Phone back gesture closes the view instead of leaving NODE.
    history.pushState({ appView: true }, "");
    const pop = () => setT(null);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [t]);
  if (!t) return null;
  const close = () => { if (history.state?.appView) history.back(); else setT(null); };
  const W = 1280;
  const scale = typeof window !== "undefined" ? Math.min(1, window.innerWidth / W) : 1;
  return (
    <div className="appview" style={{ position: "fixed", inset: 0, zIndex: 900, background: "#0a0d13", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "calc(env(safe-area-inset-top) + 6px) 8px 6px", background: "#111722", borderBottom: "1px solid #222b38" }}>
        <button type="button" className="icon-btn" aria-label="Back to NODE" onClick={close}><ChevronLeft size={22} /></button>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{t.title}{t.kind === "window" ? " · live from desktop" : ""}</div>
        {t.kind === "web" && <button type="button" className="icon-btn" aria-label={desk ? "Phone view" : "Desktop view"} title={desk ? "Phone view" : "Desktop view"} onClick={() => setDesk((d) => !d)}>{desk ? <Smartphone size={18} /> : <Monitor size={18} />}</button>}
        <button type="button" className="icon-btn" aria-label="Reload" onClick={() => setN((x) => x + 1)}><RotateCw size={18} /></button>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        {t.kind === "web" ? (
          desk ? (
            <iframe key={n} src={t.url} title={t.title} allow="clipboard-read; clipboard-write; microphone; camera; fullscreen"
              style={{ border: 0, width: W, height: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: "0 0", position: "absolute", inset: 0 }} />
          ) : (
            <iframe key={n} src={t.url} title={t.title} allow="clipboard-read; clipboard-write; microphone; camera; fullscreen" style={{ border: 0, width: "100%", height: "100%", position: "absolute", inset: 0 }} />
          )
        ) : (
          <img key={n} alt={t.title} src={`/api/windows/stream?address=${encodeURIComponent(t.address)}&fps=4&n=${n}`} style={{ width: "100%", height: "auto", display: "block" }} />
        )}
      </div>
    </div>
  );
}
