// The door hands back #door_token for cross-site front ends; NODE uses the cookie, so drop it from the URL.
if (location.hash.includes("door_token=")) history.replaceState(null, "", location.pathname + location.search);
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";

if ("serviceWorker" in navigator && (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD) {
  window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

/* Update check: /version names the current build's main script; if it isn't the one this page runs, reload once.
 * Runs on open and whenever the app comes back to the foreground (iOS resumes home-screen apps without reloading). */
if ((import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD) {
  const mine = (document.querySelector('script[type="module"][src*="/assets/index-"]') as HTMLScriptElement | null)?.src.split("/assets/")[1] ?? "";
  const check = async () => {
    try {
      const r = await fetch("/version", { cache: "no-store" });
      const { build } = (await r.json()) as { build?: string };
      if (!build || !mine || build === mine) return;
      if (sessionStorage.getItem("node:reloaded-for") === build) return; // once per build, never a loop
      sessionStorage.setItem("node:reloaded-for", build);
      try { await (await navigator.serviceWorker?.getRegistration())?.update(); } catch { /* reload anyway */ }
      location.reload();
    } catch { /* offline: try again next time */ }
  };
  void check();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void check(); });
  window.addEventListener("pageshow", (e) => { if ((e as PageTransitionEvent).persisted) void check(); });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
