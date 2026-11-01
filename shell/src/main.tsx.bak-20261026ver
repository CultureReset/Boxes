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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
