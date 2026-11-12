import { useEffect, useMemo, useState } from "react";

/** Live view of a native window, used only on phones/remote (not the local kiosk). */
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
      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000" }}
    />
  );
}

import { X } from "lucide-react";
import type { AppViewTarget } from "../lib/openApp";
import { NativeApp } from "../native/NativeApp";

type Pane = AppViewTarget & { key: string };

function paneKey(t: AppViewTarget): string {
  if (t.kind === "web") return `web:${t.url}`;
  if (t.kind === "native") return `native:${t.slug}`;
  return `window:${t.address}`;
}

/**
 * One clean, edge-to-edge, app-like pane — like opening an app on an iPad.
 * No browser chrome, no NODE header, no "open in new tab" bar.
 * A home indicator at the bottom returns to the NODE launcher (tap)
 * or shows the app switcher (long-press). Phone Back closes the pane.
 */
export function AppView() {
  const [panes, setPanes] = useState<Pane[]>([]);
  const [active, setActive] = useState<string | null>(null);
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

  const goHome = () => {
    setPanes([]);
    setActive(null);
    setSwitcher(false);
    if (history.state?.appView) history.back();
  };

  useEffect(() => {
    if (!cur) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        goHome();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur]);

  if (!cur) return null;

  return (
    <div className="appview" style={{ position: "fixed", inset: 0, zIndex: 900, background: "#000", display: "flex", flexDirection: "column" }}>
      {switcher && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 3, background: "rgba(0,0,0,0.72)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            padding: "0 16px calc(env(safe-area-inset-bottom) + 36px)", gap: 10,
            overflowX: "auto", WebkitOverflowScrolling: "touch",
          }}
          onClick={() => setSwitcher(false)}
        >
          {panes.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); setActive(p.key); setSwitcher(false); }}
              style={{
                flex: "0 0 auto", minWidth: 132, maxWidth: 180, height: 88, borderRadius: 18,
                border: p.key === cur.key ? "2px solid #0a84ff" : "1px solid #2a3545",
                background: "#151b26", color: "#e8eef7", padding: "12px 14px", textAlign: "left", position: "relative",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
              <div style={{ fontSize: 11, color: "#9aa7b8", marginTop: 6 }}>App</div>
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
                style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, display: "grid", placeItems: "center", background: "#243042" }}
              ><X size={12} /></span>
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {panes.map((p) => {
          const show = p.key === cur.key;
          const rn = 0;
          return (
            <div key={p.key} style={{ position: "absolute", inset: 0, display: show ? "block" : "none", background: "#000" }}>
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

      <button
        type="button"
        aria-label="Return to NODE"
        title="Return to NODE"
        onClick={goHome}
        onContextMenu={(e) => { e.preventDefault(); setSwitcher((s) => !s); }}
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom) + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 134,
          height: 5,
          borderRadius: 3,
          border: 0,
          padding: 0,
          background: "rgba(255,255,255,0.5)",
          boxShadow: "0 0 0 6px transparent",
          zIndex: 4,
          cursor: "pointer",
        }}
      />
    </div>
  );
}
