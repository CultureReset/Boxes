import { useEffect, useState } from "react";
import { Calendar, ChevronRight, Sun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning, CloudOff, Plane, MoreHorizontal } from "lucide-react";
import { useApi } from "../../api/client";
import type { CalendarEvent, Weather, AppEntry } from "../../api/types";
import { useStatus } from "../../state/status";
import { useWorld } from "../../state/world";
import { useLayout } from "../../state/layout";
import { greeting, firstName, clock } from "../../lib/format";
import { navigate } from "../../lib/router";
import { useShortcuts, ShortcutIcon } from "./shortcuts";
import { homeRow } from "../../modules/homeRows";
import type { ScreenProps } from "../../modules/registry";
import { askWith } from "../Agents";
import { AppIcon } from "../../components/AppIcon";

function WeatherIcon({ code, size = 22 }: { code: number; size?: number }) {
  if (code === 0 || code === 1) return <Sun size={size} />;
  if (code <= 3 || code >= 45 && code <= 48) return code >= 45 ? <CloudFog size={size} /> : <Cloud size={size} />;
  if (code >= 71 && code <= 86 && !(code >= 80 && code <= 82)) return <CloudSnow size={size} />;
  if (code >= 95) return <CloudLightning size={size} />;
  return <CloudRain size={size} />;
}

/** The light "living room" home: clock, greeting, widgets, a grid of big icons. */
export function LivingHome({ onJob }: ScreenProps) {
  const { status } = useStatus();
  const { active } = useWorld();
  const { layout } = useLayout();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const { data: events } = useApi<CalendarEvent[]>(`/api/calendar?from=${dayStart}&to=${dayEnd}`, ["calendar"]);
  const { data: weather } = useApi<Weather | null>("/api/weather", ["layout"]);
  const { data: apps } = useApi<AppEntry[]>("/api/apps", ["apps", "android"]);
  const { run, shortcuts } = useShortcuts();
  const name = active?.kind === "person" ? active.name : status ? firstName(status.user.fullName) : "";
  const colors = ["#ff453a", "#ff9f0a", "#30d158", "#0a84ff", "#bf5af2"];
  const extraRows = (layout?.rows ?? []).filter((r) => r.enabled && !["apps", "attention"].includes(r.id));

  return (
    <div className="living">
      <div className="clock-block">
        <div className="date">{now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
        <div className="clock">{clock(now).replace(/\s?[AP]M$/i, "")}</div>
        <div className="greet">{greeting(now)}, {name}</div>
        <div className="tag">{active?.tagline || "A calmer, more capable day ahead."}</div>
      </div>
      <div className="widgets">
        <button type="button" className="card widget" onClick={() => navigate("calendar")}>
          <span className="wh"><Calendar size={16} /> Today <ChevronRight size={16} className="chev" /></span>
          {(events ?? []).slice(0, 4).map((e, i) => (
            <span key={e.id} className="ev"><span className="dot" style={{ background: e.color ?? colors[i % colors.length] }} /><time>{new Date(e.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time><span className="truncate">{e.title}</span></span>
          ))}
          {events && events.length === 0 && <span className="ev dim">Nothing scheduled</span>}
          {events && events.length > 4 && <span className="ev dim"><MoreHorizontal size={14} /> {events.length - 4} more events</span>}
        </button>
        <button type="button" className="card widget weather" onClick={() => navigate("settings", "home")}>
          <span className="wh"><WeatherIcon code={weather?.code ?? 1} size={16} /> {weather?.location ?? "Weather"}</span>
          {weather ? (
            <span>
              <span className="temp">{weather.tempF}°</span>
              <div className="sub">{weather.summary}</div>
              <div className="sub" style={{ opacity: 0.85 }}>H: {weather.highF}°  L: {weather.lowF}°</div>
              {/* Never pass off a canned or stale reading as live. */}
              {weather.demo && <div className="sub" style={{ opacity: 0.9, marginTop: 6 }}><CloudOff size={12} style={{ verticalAlign: -2 }} /> Not live right now</div>}
            </span>
          ) : (
            <span>
              <span className="sub">No reading yet.</span>
              <div className="sub" style={{ opacity: 0.9 }}>Set a location in Settings, or check the connection.</div>
            </span>
          )}
        </button>
        <button type="button" className="card widget suggest" onClick={() => askWith("travel")}>
          <span className="wh"><Plane size={16} /> Travel <ChevronRight size={16} className="chev" /></span>
          <span className="pic" />
          <span className="t">A better kind of getaway</span>
          <span className="s">Ask the Travel agent for a 3-day plan crafted for you</span>
          <span className="btn sm pillbtn" style={{ alignSelf: "flex-start", marginTop: 2 }}>Plan a trip</span>
        </button>
      </div>

      <div className="icon-grid living-more">
        {shortcuts.map((s) => {
          const app = s.action.type === "app" ? apps?.find((a) => a.id === s.action.target) : undefined;
          return (
            <button key={s.id} type="button" className="big-icon" onClick={() => run(s)}>
              {app?.icon ? <span className="sq img" style={{ ["--ic" as string]: s.color }}><AppIcon icon={app.icon} name={app.name} color={app.color} size="lg" /></span> : <span className="sq" style={{ ["--ic" as string]: s.color }}><ShortcutIcon name={s.icon} size={44} /></span>}
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="living-more" style={{ marginTop: 30 }}>
        {extraRows.map((r) => {
          const mod = homeRow(r.id);
          if (!mod) return null;
          const Row = mod.component;
          return <Row key={r.id} onJob={onJob} />;
        })}
      </div>
    </div>
  );
}
