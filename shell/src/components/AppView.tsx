import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Home, Layers, X } from "lucide-react";
import type { AppViewTarget } from "../lib/openApp";
import { isLocalDesktopShell } from "../lib/openApp";
import { NativeApp } from "../native/NativeApp";

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

type Pane = AppViewTarget & { key: string };

function paneKey(t: AppViewTarget): string {
  if (t.kind === "web") return `web:${t.url}`;
  if (t.kind === "native") return `native:${t.slug}`;
  return `window:${t.address}`;
}

function useTvShell(): boolean {
  const [tv, setTv] = useState(() => (typeof document !== "undefined" ? isLocalDesktopShell() : false));
  useEffect(() => {
    const sync = () => setTv(isLocalDesktopShell());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", sync);
    return () => { obs.disconnect(); window.removeEventListener("resize", sync); };
  }, []);
  return tv;
}

/**
 * Always-visible NODE chrome for a full-app pane.
 * Sits in the layout flow (not over the iframe) so the app cannot cover it,
 * and so a 5px "home indicator" can never be the only way back.
 */
function AppViewChrome({
  title,
  tv,
  onHome,
  onSwitcher,
  canSwitch,
}: {
  title: string;
  tv: boolean;
  onHome: () => void;
  onSwitcher: () => void;
  canSwitch: boolean;
}) {
  const barH = tv ? 76 : 52;
  const btnH = tv ? 52 : 40;
  const font = tv ? 22 : 16;
  const icon = tv ? 22 : 16;
  const btn: CSSProperties = {
    flex: "0 0 auto",
    minHeight: btnH,
    minWidth: tv ? 148 : 92,
    padding: tv ? "0 24px" : "0 14px",
    borderRadius: 12,
    border: 0,
    fontSize: font,
    fontWeight: 650,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
  return (
    <nav
      aria-label="NODE navigation"
      style={{
        flex: "0 0 auto",
        minHeight: barH,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: tv ? 16 : 10,
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: `max(${tv ? 20 : 12}px, env(safe-area-inset-left))`,
        paddingRight: `max(${tv ? 20 : 12}px, env(safe-area-inset-right))`,
        background: "#10161f",
        borderBottom: "1px solid #243042",
        color: "#e8eef7",
        zIndex: 5,
      }}
    >
      <button
        type="button"
        aria-label="Return to NODE"
        title="Return to NODE"
        onClick={onHome}
        style={{ ...btn, background: "#0a84ff", color: "#fff" }}
      >
        <Home size={icon} />
        Home
      </button>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: tv ? 20 : 15,
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>
      {canSwitch && (
        <button
          type="button"
          aria-label="Switch apps"
          title="Switch apps"
          onClick={onSwitcher}
          style={{ ...btn, minWidth: tv ? 128 : 84, background: "#243042", color: "#e8eef7" }}
        >
          <Layers size={icon} />
          Apps
        </button>
      )}
    </nav>
  );
}

/**
 * One full-app pane. A reserved Home bar is always on screen — TV/kiosk,
 * Plasma, and phone — so an app can never trap the user with no way back.
 * Phone Back / Escape also closes the pane. Long-press is no longer the
 * only switcher: an Apps button appears when more than one pane is open.
 */
export function AppView() {
  const [panes, setPanes] = useState<Pane[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [switcher, setSwitcher] = useState(false);
  const tv = useTvShell();

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
    <div className="appview" style={{ position: "fixed", inset: 0, zIndex: 900, background: "#10161f", display: "flex", flexDirection: "column" }}>
      <AppViewChrome
        title={cur.title}
        tv={tv}
        onHome={goHome}
        onSwitcher={() => setSwitcher((s) => !s)}
        canSwitch={panes.length > 1}
      />

      <div style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}>
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
    </div>
  );
}
