import { Search, Settings, Bell, ChevronDown } from "lucide-react";
import { useStatus } from "../state/status";
import { useWorld } from "../state/world";
import { navigate } from "../lib/router";
import { firstName, initials } from "../lib/format";

import { SCREENS } from "../modules/registry";

const NAV = SCREENS.filter((s) => s.nav).map((s) => ({ id: s.id, label: s.title }));

export function TopBar({ active, onSearch, onNotifications, unread, onUser }: { active: string; onSearch: () => void; onNotifications: () => void; unread: number; onUser: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const { status } = useStatus();
  const { active: world } = useWorld();
  const name = world?.kind === "person" ? world.name : status ? firstName(status.user.fullName) : "";

  return (
    <div className="topbar">
      <button type="button" className="wordmark" onClick={() => navigate("home")} aria-label="NODE home">
        NODE
      </button>
      <nav className="tabs" aria-label="Main">
        {NAV.map((n) => (
          <button key={n.id} type="button" className={`tab${active === n.id ? " active" : ""}`} onClick={() => navigate(n.id)}>
            {n.label}
          </button>
        ))}
      </nav>
      <div className="topbar-right">
        <button type="button" className="icon-btn" aria-label="Search" onClick={onSearch}>
          <Search size={20} />
        </button>
        <button type="button" className="icon-btn" aria-label="Notifications" onClick={onNotifications}>
          <Bell size={19} />
          {unread > 0 && <span className="dot" />}
        </button>
        <button type="button" className="icon-btn" aria-label="Settings" onClick={() => navigate("settings")}>
          <Settings size={20} />
        </button>
        <button type="button" className="user-chip" onClick={onUser} aria-label="Account menu">
          <span className={`avatar${world ? " world" : ""}`} style={world ? { ["--ic" as string]: world.color } : undefined}>{world ? world.name.charAt(0) : status ? initials(status.user.fullName) : "·"}</span>
          <span className="name stack" style={{ fontWeight: 500, gap: 0, lineHeight: 1.15 }}>
            <span>{name}</span>
            {world && world.kind !== "person" && <span className="tiny muted">{world.name}</span>}
          </span>
          <ChevronDown size={14} className="name" style={{ color: "var(--text-3)" }} />
        </button>
      </div>
    </div>
  );
}
