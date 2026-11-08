import { useState } from "react";
import { colorFor } from "../lib/format";

/**
 * Real icon from the daemon's icon theme lookup when available; otherwise a
 * coloured rounded square with the app's initial, the way phones show apps
 * that have no artwork yet.
 */
export function AppIcon({ icon, name, color, size = "md" }: { icon?: string; name: string; color?: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const c = color ?? colorFor(name);
  const cls = `app-icon ${size}`;
  if (icon && !failed && !window.__NODE_DEMO_ICONS__) {
    return (
      <div className={`${cls} real`} style={{ ["--ic" as string]: c }}>
        <img src={`/api/icon/${encodeURIComponent(icon)}`} alt="" onError={() => setFailed(true)} loading="lazy" draggable={false} />
      </div>
    );
  }
  return (
    <div className={cls} style={{ ["--ic" as string]: c }} aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

declare global {
  interface Window {
    __NODE_DEMO_ICONS__?: boolean;
  }
}
