import { useEffect, useMemo, useState } from "react";
import { Bot, Calendar, ChevronRight, Cpu, Folder, HardDrive, MemoryStick, Sparkles, Thermometer, Zap, Wifi, Bell } from "lucide-react";
import { useApi } from "../../api/client";
import type { AgentsInfo, AppEntry, Automation, CalendarEvent, Job, Notification, Weather } from "../../api/types";
import { useStatus } from "../../state/status";
import { useWorld } from "../../state/world";
import { greeting, firstName, timeRange } from "../../lib/format";
import { navigate } from "../../lib/router";
import { openApp } from "../../lib/openApp";
import { useToast } from "../../state/toast";
import { AppIcon } from "../../components/AppIcon";
import { askWith } from "../Agents";
import type { ScreenProps } from "../../modules/registry";

interface SysInfo {
  kernel?: string;
  distro?: string;
  memory?: string;
  cpu?: string;
  arch?: string;
  hostname?: string;
}

const AGENT_SLUGS = new Set(["openjarvis", "paperclip", "grok-bot", "grokbot"]);
const AGENT_NAMES = ["openjarvis", "paperclip", "grok bot", "grok"];

function isAgentApp(a: AppEntry): boolean {
  const slug = (a.id || "").replace(/^web:/, "").toLowerCase();
  const name = (a.name || "").toLowerCase();
  if (AGENT_SLUGS.has(slug)) return true;
  return AGENT_NAMES.some((n) => name === n || name.startsWith(n + " "));
}

function groupApps(apps: AppEntry[]) {
  const top = apps.filter((a) => a.provider === "web" && !a.parent && !isAgentApp(a));
  const business = ["twenty-crm", "crm2", "pos", "tickets", "kamra", "supabase"];
  const ops = ["n8n", "uptime-kuma", "mcp", "searxng", "llama-swap", "litellm", "crawl4ai"];
  const media = ["navidrome", "minidlna", "notes", "desktop"];
  const id = (a: AppEntry) => a.id.replace(/^web:/, "");
  const buckets: { title: string; items: AppEntry[] }[] = [
    { title: "Business", items: top.filter((a) => business.includes(id(a))) },
    { title: "Operations", items: top.filter((a) => ops.includes(id(a))) },
    { title: "Media & workspace", items: top.filter((a) => media.includes(id(a))) },
  ];
  const used = new Set(buckets.flatMap((b) => b.items.map((a) => a.id)));
  const rest = top.filter((a) => !used.has(a.id));
  if (rest.length) buckets.push({ title: "More apps", items: rest });
  return buckets.filter((b) => b.items.length);
}

export function CleanHome({ onJob: _onJob }: ScreenProps) {
  const { status } = useStatus();
  const { active } = useWorld();
  const toast = useToast();
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
  const { data: info } = useApi<AgentsInfo>("/api/agents", ["world"]);
  const { data: autos } = useApi<{ items: Automation[]; templates: Omit<Automation, "id">[] }>("/api/automations", ["automations", "world"]);
  const { data: jobs } = useApi<Job[]>("/api/jobs", ["job"]);
  const { data: notifs } = useApi<Notification[]>("/api/notifications", ["notification", "notifications"]);
  const { data: sys } = useApi<SysInfo>("/api/system");

  const name = active?.kind === "person" ? active.name : status ? firstName(status.user.fullName) : "";
  const unread = (notifs ?? []).filter((n) => !n.read);
  const nextEvent = (events ?? []).find((e) => Date.parse(e.end) > Date.now());
  const remaining = (events ?? []).filter((e) => Date.parse(e.end) > Date.now()).length;
  const runningAutos = (autos?.items ?? []).filter((a) => a.enabled);
  const runningJobs = (jobs ?? []).filter((j) => j.status === "running");
  const webApps = (apps ?? []).filter((a) => a.provider === "web" && !a.parent);
  const agentApps = useMemo(() => {
    const found = (apps ?? []).filter((a) => isAgentApp(a) && !a.parent);
    const byKey = new Map(found.map((a) => [a.name.toLowerCase(), a]));
    const preferred = ["Grok Bot", "OpenJarvis", "Paperclip"];
    const ordered: { name: string; app?: AppEntry; blurb: string; color: string }[] = [
      { name: "Grok Bot", app: found.find((a) => /grok/i.test(a.name)), blurb: "Ask or send work", color: "#0a84ff" },
      { name: "OpenJarvis", app: found.find((a) => /jarvis/i.test(a.name)), blurb: "Front door — talk and act", color: "#30d158" },
      { name: "Paperclip", app: found.find((a) => /paperclip/i.test(a.name)), blurb: byKey.get("paperclip")?.includes?.length ? `Orchestrator · with ${found.find((a) => /paperclip/i.test(a.name))?.includes?.join(" · ")}` : "Orchestrator", color: "#ff9f0a" },
    ];
    for (const a of found) {
      if (!preferred.some((n) => n.toLowerCase() === a.name.toLowerCase() || (n === "Grok Bot" && /grok/i.test(a.name)) || (n === "OpenJarvis" && /jarvis/i.test(a.name)))) {
        ordered.push({ name: a.name, app: a, blurb: a.comment || "Agent", color: a.color || "#bf5af2" });
      }
    }
    void preferred;
    return ordered;
  }, [apps]);

  const launch = (a?: AppEntry) => {
    if (!a) return navigate("agents");
    void openApp(a, toast);
  };

  const uptime = status?.uptimeSeconds ? formatUptime(status.uptimeSeconds) : "—";

  return (
    <div className="clean-home">
      <header className="clean-hero">
        <div className="clean-hero-text">
          <div className="clean-kicker">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1>{greeting(now)}{name ? `, ${name}` : ""}.</h1>
          <p className="clean-tag">{active?.tagline || "Your life, your rules."}</p>
        </div>
        {weather && (
          <button type="button" className="clean-weather" onClick={() => navigate("settings", "home")}>
            <span className="clean-temp">{weather.tempF}°</span>
            <span className="clean-weather-meta">
              <span>{weather.summary}</span>
              <span className="dim">{weather.location}{weather.demo ? " · not live" : ""}</span>
            </span>
          </button>
        )}
      </header>

      <section className="clean-section" aria-labelledby="sec-today">
        <header className="clean-section-h">
          <h2 id="sec-today">Today</h2>
          <button type="button" className="link" onClick={() => navigate("calendar")}>Calendar <ChevronRight size={14} /></button>
        </header>
        <div className="clean-today">
          <button type="button" className="clean-card" onClick={() => navigate("calendar")}>
            <Calendar size={18} />
            <span className="t">{events == null ? "—" : remaining} {remaining === 1 ? "meeting" : "meetings"} today</span>
            <span className="s">{nextEvent ? `${nextEvent.title} · ${timeRange(nextEvent.start, nextEvent.end, nextEvent.allDay)}` : "Nothing scheduled"}</span>
          </button>
          <button type="button" className="clean-card" onClick={() => navigate("settings", "notifications")}>
            <Bell size={18} />
            <span className="t">{unread.length} {unread.length === 1 ? "alert" : "alerts"}</span>
            <span className="s">{unread.length === 0 ? "All clear" : (unread[0]?.app && !/^(local machine|notification|alert)$/i.test(unread[0]?.app) ? unread[0].app : unread[0]?.title || "Needs attention")}</span>
          </button>
          <button type="button" className="clean-card" onClick={() => navigate("automations")}>
            <Zap size={18} />
            <span className="t">{runningAutos.length} {runningAutos.length === 1 ? "automation" : "automations"} running</span>
            <span className="s">{runningJobs.length ? `${runningJobs.length} job${runningJobs.length === 1 ? "" : "s"} in progress` : "Scheduled helpers"}</span>
          </button>
        </div>
      </section>

      <section className="clean-section" aria-labelledby="sec-agents">
        <header className="clean-section-h">
          <h2 id="sec-agents">Agents</h2>
          <button type="button" className="link" onClick={() => { navigate("agents"); askWith("auto"); }}>Ask the Orchestrator <Sparkles size={14} /></button>
        </header>
        <div className="clean-agents">
          {agentApps.map((row) => (
            <button key={row.name} type="button" className="clean-agent" onClick={() => launch(row.app)}>
              <span className="app-icon" style={{ ["--ic" as string]: row.app?.color || row.color }}>
                {row.app ? <AppIcon icon={row.app.icon} name={row.name} color={row.app.color} /> : <Bot size={22} />}
              </span>
              <span className="stack">
                <span className="t">{row.name}</span>
                <span className="s">{row.app ? row.blurb : "Not registered as an app yet — open Agents"}</span>
              </span>
            </button>
          ))}
        </div>
        {(info?.personas ?? []).filter((p) => p.id !== "auto").length > 0 && (
          <div className="clean-personas">
            {(info?.personas ?? []).filter((p) => p.id !== "auto").slice(0, 8).map((p) => (
              <button key={p.id} type="button" className="clean-chip" onClick={() => askWith(p.id)}>{p.name}</button>
            ))}
          </div>
        )}
      </section>

      <section className="clean-section" aria-labelledby="sec-apps">
        <header className="clean-section-h">
          <h2 id="sec-apps">Apps</h2>
          <button type="button" className="link" onClick={() => navigate("apps")}>All apps <ChevronRight size={14} /></button>
        </header>
        {groupApps(apps ?? []).map((g) => (
          <div key={g.title} className="clean-app-group">
            <h3>{g.title}</h3>
            <div className="clean-apps">
              {g.items.map((a) => (
                <button key={a.id} type="button" className="clean-app" onClick={() => void openApp(a, toast)}>
                  <AppIcon icon={a.icon} name={a.name} color={a.color} />
                  <span className="t">{a.name}</span>
                  <span className="s">{a.comment || "App"}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {apps && webApps.length === 0 && <p className="dim">No web apps registered yet.</p>}
      </section>

      <section className="clean-section" aria-labelledby="sec-auto">
        <header className="clean-section-h">
          <h2 id="sec-auto">Automations</h2>
          <button type="button" className="link" onClick={() => navigate("automations")}>View all <ChevronRight size={14} /></button>
        </header>
        <div className="clean-list">
          {runningAutos.length === 0 && (autos?.templates ?? []).slice(0, 3).map((t) => (
            <button key={t.name} type="button" className="clean-row" onClick={() => navigate("automations")}>
              <Zap size={16} />
              <span className="stack"><span className="t">{t.name}</span><span className="s">{t.description} · suggested</span></span>
            </button>
          ))}
          {runningAutos.map((a) => (
            <button key={a.id} type="button" className="clean-row" onClick={() => navigate("automations")}>
              <Zap size={16} />
              <span className="stack"><span className="t">{a.name}</span><span className="s">{a.description}</span></span>
              <span className="pill">{a.enabled ? "Active" : "Paused"}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="clean-section" aria-labelledby="sec-sys">
        <header className="clean-section-h">
          <h2 id="sec-sys">System</h2>
          <button type="button" className="link" onClick={() => navigate("system")}>Vitals <ChevronRight size={14} /></button>
        </header>
        <div className="clean-vitals">
          <Vital icon={<Cpu size={16} />} label="CPU" value={sys?.cpu ? shortCpu(sys.cpu) : "—"} />
          <Vital icon={<MemoryStick size={16} />} label="Memory" value={sys?.memory ?? "—"} />
          <Vital icon={<HardDrive size={16} />} label="Host" value={sys?.distro ?? status?.user.hostname ?? "—"} />
          <Vital icon={<Thermometer size={16} />} label="Uptime" value={uptime} />
          <Vital icon={<Wifi size={16} />} label="Network" value={status?.network.online ? (status.network.type === "wifi" ? status.network.ssid || "Wi-Fi" : "Ethernet") : "Offline"} />
          <Vital icon={<Folder size={16} />} label="Updates" value={status?.updates == null ? "Can't check" : String(status.updates)} />
        </div>
        <p className="clean-sys-note dim">GPU temperature, power draw and live process stats belong on the System page (node-vitals). This card uses the daemon's status and system info only — no extra sensors were added here.</p>
      </section>
    </div>
  );
}

function Vital({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="clean-vital">
      <span className="clean-vital-l">{icon} {label}</span>
      <span className="t">{value}</span>
    </div>
  );
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function shortCpu(cpu: string): string {
  return cpu.replace(/Processor/i, "").replace(/\s+/g, " ").trim();
}

