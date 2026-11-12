import { useEffect, useMemo, useState } from "react";

/** iOS Safari does not paint multipart/x-mixed-replace in <img>; poll single JPEGs instead. */
function WindowStream({ address, title, n }: { address: string; title: string; n: number }) {
  const [src, setSrc] = useState(() => `/api/windows/stream?address=${encodeURIComponent(address)}&once=1&n=${n}&t=0`);
  useEffect(() => {
    let alive = true;
    let t = 0;
    let timer: number | undefined;
    const bump = () => {
      if (!alive) return;
      t += 1;
      setSrc(`/api/windows/stream?address=${encodeURIComponent(address)}&once=1&n=${n}&t=${t}`);
      timer = window.setTimeout(bump, 400);
    };
    timer = window.setTimeout(bump, 400);
    return () => { alive = false; if (timer) window.clearTimeout(timer); };
  }, [address, n]);
  return (
    <img
      alt={title}
      src={src}
      style={{ width: "100%", height: "auto", maxHeight: "100%", objectFit: "contain", display: "block", margin: "0 auto", background: "#0a0d13" }}
    />
  );
}

import { ChevronLeft, ExternalLink, Home, LayoutGrid, RotateCw, X } from "lucide-react";
import type { AppViewTarget } from "../lib/openApp";
import { NativeApp } from "../native/NativeApp";

type Pane = AppViewTarget & { key: string };

function paneKey(t: AppViewTarget): string {
  if (t.kind === "web") return `web:${t.url}`;
  if (t.kind === "native") return `native:${t.slug}`;
  return `window:${t.address}`;
}

/** Fullscreen in-app viewer: the REAL web app UI, edge-to-edge, like opening a
 *  phone app. Keep several open and switch; Home returns to the NODE launcher. */
export function AppView() {
  const [panes, setPanes] = useState<Pane[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [reload, setReload] = useState<Record<string, number>>({});
  const [switcher, setSwitcher] = useState(false);

  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<AppViewTarget>).detail;
      const key = paneKey(t);
      setPanes((prev) => (prev.some((p) => p.key === key) ? prev : [...prev, { ...t, key }]));
      setActive(key);
      setSwitcher(false);
    };
    window.addEventListener("node:app-view", on);
    return () => window.removeEventListener("node:app-view", on);
  }, []);

  useEffect(() => {
    if (!active) return;
    history.pushState({ appView: true }, "");
    const pop = () => {
      // Phone back: close active pane, or leave viewer when last pane closes.
      setPanes((prev) => {
        const next = prev.filter((p) => p.key !== active);
        setActive(next.length ? next[next.length - 1].key : null);
        return next;
      });
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [active]);

  const cur = useMemo(() => panes.find((p) => p.key === active) ?? null, [panes, active]);
  if (!cur) return null;

  const goHome = () => {
    setPanes([]);
    setActive(null);
    setSwitcher(false);
    if (history.state?.appView) history.back();
  };
  const closeActive = () => {
    if (history.state?.appView) history.back();
    else {
      setPanes((prev) => {
        const next = prev.filter((p) => p.key !== cur.key);
        setActive(next.length ? next[next.length - 1].key : null);
        return next;
      });
    }
  };
  const openExternal = () => {
    if (cur.kind === "web") {
      if (!window.open(cur.url, "_blank", "noopener")) window.location.href = cur.url;
    }
  };
  const bump = () => setReload((r) => ({ ...r, [cur.key]: (r[cur.key] ?? 0) + 1 }));
  const n = reload[cur.key] ?? 0;

  return (
    <div className="appview" style={{ position: "fixed", inset: 0, zIndex: 900, background: "#0a0d13", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "calc(env(safe-area-inset-top) + 6px) 8px 6px", background: "#111722", borderBottom: "1px solid #222b38" }}>
        <button type="button" className="icon-btn" aria-label="Back" onClick={closeActive}><ChevronLeft size={22} /></button>
        <button type="button" className="icon-btn" aria-label="Home" title="Back to NODE home" onClick={goHome}><Home size={18} /></button>
        <button type="button" className="icon-btn" aria-label="App switcher" title="Switch apps" onClick={() => setSwitcher((s) => !s)}><LayoutGrid size={18} /></button>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{cur.title}</div>
        {cur.kind === "web" && (
          <button type="button" className="icon-btn" aria-label="Open in new tab" title="Open in new tab" onClick={openExternal}><ExternalLink size={18} /></button>
        )}
        <button type="button" className="icon-btn" aria-label="Reload" onClick={bump}><RotateCw size={18} /></button>
      </div>

      {switcher && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 10px 12px", background: "#0d121b", borderBottom: "1px solid #222b38", WebkitOverflowScrolling: "touch" }}>
          {panes.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => { setActive(p.key); setSwitcher(false); }}
              style={{
                flex: "0 0 auto", minWidth: 112, maxWidth: 160, height: 64, borderRadius: 14, border: p.key === cur.key ? "2px solid #0a84ff" : "1px solid #2a3545",
                background: "#151b26", color: "#e8eef7", padding: "8px 10px", textAlign: "left", position: "relative",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
              <div style={{ fontSize: 10, color: "#9aa7b8", marginTop: 4 }}>{p.kind === "web" ? "App" : p.kind}</div>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Close ${p.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPanes((prev) => {
                    const next = prev.filter((x) => x.key !== p.key);
                    if (p.key === cur.key) setActive(next.length ? next[next.length - 1].key : null);
                    return next;
                  });
                }}
                style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, display: "grid", placeItems: "center", background: "#243042" }}
              ><X size={12} /></span>
            </button>
          ))}
          <button type="button" onClick={goHome} style={{ flex: "0 0 auto", minWidth: 96, height: 64, borderRadius: 14, border: "1px dashed #3a4658", background: "transparent", color: "#9aa7b8" }}>
            Home
          </button>
        </div>
      )}

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {panes.map((p) => {
          const show = p.key === cur.key;
          const rn = p.key === cur.key ? n : (reload[p.key] ?? 0);
          return (
            <div key={p.key} style={{ position: "absolute", inset: 0, display: show ? "block" : "none", background: "#0a0d13" }}>
              {p.kind === "native" ? (
                <NativeApp key={rn} slug={p.slug} n={rn} />
              ) : p.kind === "web" ? (
                <iframe
                  key={rn}
                  src={p.url}
                  title={p.title}
                  allow="clipboard-read; clipboard-write; microphone; camera; fullscreen; autoplay; display-capture"
                  style={{ border: 0, width: "100%", height: "100%", position: "absolute", inset: 0, background: "#fff" }}
                />
              ) : (
                <WindowStream key={rn} address={p.address} title={p.title} n={rn} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
