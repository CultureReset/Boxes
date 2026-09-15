import { useEffect, useState } from "react";
import { Search, Settings, Bell, Wifi, WifiOff, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, Volume2, VolumeX, Bluetooth, ChevronDown } from "lucide-react";
import { useStatus } from "../state/status";
import { useWorld } from "../state/world";
import { navigate } from "../lib/router";
import { clock, firstName, initials } from "../lib/format";

import { SCREENS } from "../modules/registry";

const NAV = SCREENS.filter((s) => s.nav).map((s) => ({ id: s.id, label: s.title }));

export function TopBar({ active, onSearch, onNotifications, unread, onUser }: { active: string; onSearch: () => void; onNotifications: () => void; unread: number; onUser: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const { status } = useStatus();
  const { active: world } = useWorld();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  const name = world?.kind === "person" ? world.name : status ? firstName(status.user.fullName) : "";
  const bat = status?.battery;
  const BatIcon = !bat?.present ? null : bat.charging ? BatteryCharging : bat.percent > 60 ? BatteryFull : bat.percent > 25 ? BatteryMedium : BatteryLow;

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
        <div className="status-strip" title={status?.network.ssid}>
          <span>{clock(now)}</span>
          {status?.network.online ? <Wifi size={16} /> : <WifiOff size={16} />}
          {status?.bluetooth.powered && status.bluetooth.connected.length > 0 && <Bluetooth size={15} />}
          {status?.audio && (status.audio.muted ? <VolumeX size={16} /> : <Volume2 size={16} />)}
          {BatIcon && bat && (
            <span className="row" style={{ gap: 4 }}>
              <BatIcon size={17} color={bat.percent <= 15 && !bat.charging ? "var(--red)" : undefined} />
              <span className="small">{bat.percent}%</span>
            </span>
          )}
        </div>
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
