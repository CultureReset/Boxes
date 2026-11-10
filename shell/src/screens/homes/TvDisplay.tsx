import { useEffect, useState } from "react";
import { Bell, Bot, Cloud, CloudFog, CloudLightning, CloudOff, CloudRain, CloudSnow, Cpu, HardDrive, MemoryStick, Sparkles, Sun, Wifi } from "lucide-react";
import { useApi } from "../../api/client";
import type { AgentsInfo, AppEntry, Automation, CalendarEvent, Job, Notification, Weather } from "../../api/types";
import { useStatus } from "../../state/status";
import { useWorld } from "../../state/world";
import { clock, firstName, greeting, timeRange } from "../../lib/format";
import { navigate } from "../../lib/router";
import type { ScreenProps } from "../../modules/registry";

interface SysInfo { memory?: string; cpu?: string; distro?: string; hostname?: string }

function WeatherIcon({ code, size = 28 }: { code: number; size?: number }) {
  if (code === 0 || code === 1) return <Sun size={size} />;
  if (code <= 3 || (code >= 45 && code <= 48)) return code >= 45 ? <CloudFog size={size} /> : <Cloud size={size} />;
  if (code >= 71 && code <= 86 && !(code >= 80 && code <= 82)) return <CloudSnow size={size} />;
  if (code >= 95) return <CloudLightning size={size} />;
  return <CloudRain size={size} />;
}

/** Ambient MagicMirror-style TV board. Not the phone or desktop home enlarged.
 *  All sizes are viewport-relative — no hardcoded screen size. */
export function TvDisplay(_: ScreenProps) {
  const { status } = useStatus();
  const { active } = useWorld();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const { data: events } = useApi<CalendarEvent[]>(`/api/calendar?from=${dayStart}&to=${dayEnd}`, ["calendar"]);
  const { data: weather } = useApi<Weather | null>("/api/weather", ["layout"]);
  const { data: info } = useApi<AgentsInfo>("/api/agents", ["world"]);
  const { data: autos } = useApi<{ items: Automation[] }>("/api/automations", ["automations", "world"]);
  const { data: jobs } = useApi<Job[]>("/api/jobs", ["job"]);
  const { data: notifs } = useApi<Notification[]>("/api/notifications", ["notification", "notifications"]);
  const { data: sys } = useApi<SysInfo>("/api/system");
  const { data: apps } = useApi<AppEntry[]>("/api/apps", ["apps"]);

  const name = active?.kind === "person" ? active.name : status ? firstName(status.user.fullName) : "";
  const upcoming = (events ?? []).filter((e) => Date.parse(e.end) > Date.now()).slice(0, 6);
  const unread = (notifs ?? []).filter((n) => !n.read).slice(0, 5);
  const runningAutos = (autos?.items ?? []).filter((a) => a.enabled);
  const runningJobs = (jobs ?? []).filter((j) => j.status === "running");
  const personas = (info?.personas ?? []).filter((p) => p.id !== "auto");
  const agentNames = ["Grok Bot", "OpenJarvis", "Paperclip"].map((n) => {
    const key = n.toLowerCase().replace(" bot", "");
    return { name: n, present: (apps ?? []).some((a) => a.name.toLowerCase().includes(key)) };
  });

  const parts = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).formatToParts(now);
  const pick = (typ: string) => parts.find((p) => p.type === typ)?.value ?? "";
  const date = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const uptime = status?.uptimeSeconds != null ? formatUptime(status.uptimeSeconds) : "—";

  return (
    <div className="tv-display">
      <div className="tv-clock-col">
        <div className="tv-date">{date}</div>
        <div className="tv-clock" aria-label={clock(now)}>
          <span className="tv-time">{pick("hour")}:{pick("minute")}</span>
          <span className="tv-clock-side">
            {pick("dayPeriod") && <span className="tv-ampm">{pick("dayPeriod")}</span>}
            <span className="tv-sec">{pick("second")}</span>
          </span>
        </div>
        {name && <div className="tv-greet">{greeting(now)}, {name}.</div>}
        <button type="button" className="tv-weather" onClick={() => navigate("settings", "home")}>
          {weather ? (
            <>
              <WeatherIcon code={weather.code} />
              <span className="tv-temp">{weather.tempF}°</span>
              <span className="tv-weather-meta">
                <span>{weather.summary}</span>
                <span>{weather.location}{weather.demo ? " · not live" : ""} · H {weather.highF}° / L {weather.lowF}°</span>
              </span>
            </>
          ) : (
            <>
              <CloudOff size={28} />
              <span className="tv-weather-meta"><span>Weather</span><span>Set a location in Settings</span></span>
            </>
          )}
        </button>
      </div>

      <div className="tv-agenda">
        <h2>Today</h2>
        {upcoming.length === 0 && <p className="tv-empty">Nothing on the calendar.</p>}
        <ul>
          {upcoming.map((e) => (
            <li key={e.id}>
              <time>{e.allDay ? "All day" : timeRange(e.start, e.end, false).split("–")[0].trim()}</time>
              <span>{e.title}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="tv-agents">
        <h2>Agents</h2>
        <div className="tv-agent-status">
          {agentNames.map((a) => (
            <div key={a.name} className="tv-agent-pill">
              <Bot size={16} />
              <span>{a.name}</span>
              <span className={`tv-dot ${a.present ? "on" : "off"}`} />
            </div>
          ))}
        </div>
        <p className="tv-agent-line">
          <Sparkles size={16} />
          {runningJobs.length ? `Working on ${runningJobs.length}` : "Ready"}
          {" · "}
          {personas.length} in this world
          {" · "}
          {runningAutos.length} automation{runningAutos.length === 1 ? "" : "s"} running
        </p>
      </div>

      <div className="tv-vitals">
        <h2>System</h2>
        <div className="tv-vital-grid">
          <div><Cpu size={16} /> <span>CPU</span> <b>{sys?.cpu ? sys.cpu.replace(/Processor/i, "").trim() : "—"}</b></div>
          <div><MemoryStick size={16} /> <span>Memory</span> <b>{sys?.memory ?? "—"}</b></div>
          <div><HardDrive size={16} /> <span>System</span> <b>{sys?.distro ?? "—"}</b></div>
          <div><Wifi size={16} /> <span>Network</span> <b>{status?.network.online ? (status.network.type === "wifi" ? status.network.ssid || "Wi-Fi" : "Ethernet") : "Offline"}</b></div>
          <div><span>Uptime</span> <b>{uptime}</b></div>
          <div><span>Updates</span> <b>{status?.updates ?? "—"}</b></div>
        </div>
      </div>

      <div className="tv-alerts">
        <h2>Alerts</h2>
        {unread.length === 0 && <p className="tv-empty"><Bell size={16} /> All clear</p>}
        <ul>
          {unread.slice(0, 5).map((n) => (
            <li key={n.id}><Bell size={14} /> <span>{alertLabel(n)}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function alertLabel(n: Notification): string {
  const generic = !n.title || /^(local machine|notification|alert)$/i.test(n.title);
  const head = generic ? (n.app || n.title || "Alert") : (n.app && n.app !== n.title ? `${n.app} · ${n.title}` : (n.title || n.app || "Alert"));
  const body = (n.body || "").replace(/\s+/g, " ").trim();
  if (!body) return head;
  return `${head}: ${body.length > 80 ? body.slice(0, 77) + "…" : body}`;
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
