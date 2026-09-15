import { useMemo } from "react";
import { Calendar, AppWindow, Bell, BatteryLow, Clock, Zap, Plus, Play, Package, Smartphone, Globe, Usb } from "lucide-react";
import { api, useApi } from "../api/client";
import type { AndroidStatus, AppEntry, Automation, CalendarEvent, FileEntry, Notification, WindowEntry } from "../api/types";
import { useStatus } from "../state/status";
import { useToast } from "../state/toast";
import { Section } from "../components/Section";
import { ItemCard } from "../components/ItemCard";
import { AppIcon } from "../components/AppIcon";
import { Dot, Pill, Skeleton } from "../components/ui";
import { navigate } from "../lib/router";
import { timeAgo, timeRange, clock } from "../lib/format";
import { useMenu } from "../components/Menu";
import { AUTOMATION_ICONS } from "./Automations";
import { FileGlyph } from "./Files";
import type { RowProps } from "../modules/homeRows";

/* Each row is a self-contained widget: it fetches what it needs and renders
   one Section. Rows never depend on each other, so any can be removed. */

function useApps() {
  const { data } = useApi<AppEntry[]>("/api/apps", ["apps", "android"]);
  const byId = useMemo(() => new Map((data ?? []).map((a) => [a.id, a])), [data]);
  return { apps: data, byId };
}

function useLaunch() {
  const toast = useToast();
  return (id: string) => void api.post<{ ok: boolean; message: string }>("/api/apps/launch", { id }).then((r) => toast(r.message, r.ok ? "ok" : "error")).catch((e) => toast(e.message, "error"));
}

function todayRange() {
  const t = new Date();
  return { from: new Date(t.getFullYear(), t.getMonth(), t.getDate()).toISOString(), to: new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).toISOString() };
}

export function AttentionRow(_: RowProps) {
  const { status } = useStatus();
  const { apps, byId } = useApps();
  const { from, to } = todayRange();
  const { data: events } = useApi<CalendarEvent[]>(`/api/calendar?from=${from}&to=${to}`, ["calendar"]);
  const { data: notifs } = useApi<Notification[]>("/api/notifications", ["notification", "notifications"]);
  const { data: recent } = useApi<FileEntry[]>("/api/files/recent");
  const launch = useLaunch();
  const unread = (notifs ?? []).filter((n) => !n.read);
  const byApp = useMemo(() => {
    const m = new Map<string, Notification[]>();
    for (const n of unread) m.set(n.app, [...(m.get(n.app) ?? []), n]);
    return [...m.entries()];
  }, [unread]);
  const nextEvent = (events ?? []).find((e) => Date.parse(e.end) > Date.now());
  const updates = status?.updates ?? 0;
  const lowBattery = status?.battery?.present && status.battery.percent <= 20 && !status.battery.charging;
  const empty = byApp.length === 0 && !nextEvent && updates === 0 && !lowBattery && (recent ?? []).length === 0;

  return (
    <Section title="Needs Attention" onTitle={() => navigate("settings", "notifications")}>
      {byApp.map(([app, list]) => {
        const a = byId.get(app) ?? (apps ?? []).find((x) => x.name === app);
        return <ItemCard key={app} icon={<AppIcon icon={a?.icon} name={app} color={a?.color} />} title={app} subtitle={`${list.length} new ${list.length === 1 ? "notification" : "notifications"}`} meta={list[0].title} badge={<Dot state="alert" />} onClick={() => a && launch(a.id)} />;
      })}
      {nextEvent && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: nextEvent.color ?? "#ff453a" }}><Calendar size={26} /></span>} title={nextEvent.title} subtitle={Date.parse(nextEvent.start) > Date.now() ? `In ${Math.max(1, Math.round((Date.parse(nextEvent.start) - Date.now()) / 60000))} minutes` : "Happening now"} meta={<><Clock size={12} /> {timeRange(nextEvent.start, nextEvent.end, nextEvent.allDay)} · Calendar</>} onClick={() => navigate("calendar")} />}
      {updates > 0 && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: "#0a84ff" }}><Package size={26} /></span>} title="Updates ready" subtitle={`${updates} package${updates === 1 ? "" : "s"} can be updated`} meta="Settings · Updates" badge={<Dot state="info" />} onClick={() => navigate("settings", "updates")} />}
      {lowBattery && status?.battery && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: "#ff453a" }}><BatteryLow size={26} /></span>} title="Battery low" subtitle={`${status.battery.percent}% remaining`} meta="Plug in soon" badge={<Dot state="alert" />} onClick={() => navigate("settings", "power")} />}
      {(recent ?? []).slice(0, 2).map((f) => <ItemCard key={f.path} icon={<FileGlyph kind={f.kind} />} title={f.name} subtitle={f.kind === "folder" ? "Folder" : `Edited ${timeAgo(f.modified)}`} meta={`Files · ${f.path.split("/").slice(0, -1).join("/") || "~"}`} onClick={() => void api.post("/api/open", { target: f.path })} />)}
      {empty && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: "#30d158" }}><Bell size={26} /></span>} title="All clear" subtitle="Nothing needs your attention right now" meta={clock()} />}
    </Section>
  );
}

export function ContinueRow(_: RowProps) {
  const { byId } = useApps();
  const { data: windows } = useApi<WindowEntry[]>("/api/windows", ["windows"]);
  const { data: recent } = useApi<FileEntry[]>("/api/files/recent");
  const menu = useMenu();
  return (
    <Section title="Continue" onTitle={() => navigate("apps")}>
      {windows === null && [1, 2, 3].map((i) => <Skeleton key={i} h={92} w={300} />)}
      {(windows ?? []).map((w) => {
        const a = w.appId ? byId.get(w.appId) : undefined;
        return <ItemCard key={w.address} icon={<AppIcon icon={a?.icon ?? w.class} name={a?.name ?? w.class} color={a?.color} />} title={a?.name ?? w.class} subtitle={w.title} meta={<>{w.focused ? <Dot state="on" /> : <Dot state="off" />} {w.focused ? "Active" : `Workspace ${w.workspace}`}</>} onClick={() => void api.post("/api/windows/focus", { address: w.address })} onMore={(e) => menu.open(e, [{ label: "Switch to", onClick: () => void api.post("/api/windows/focus", { address: w.address }) }, { label: "Close", danger: true, onClick: () => void api.post("/api/windows/close", { address: w.address }) }])} />;
      })}
      {(recent ?? []).slice(0, 4).map((f) => <ItemCard key={f.path} icon={<FileGlyph kind={f.kind} />} title={f.name} subtitle={`Edited ${timeAgo(f.modified)}`} meta="Files" onClick={() => void api.post("/api/open", { target: f.path })} />)}
      {windows && windows.length === 0 && (recent ?? []).length === 0 && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: "#636e7b" }}><AppWindow size={26} /></span>} title="Nothing open yet" subtitle="Open an app and it will show up here" onClick={() => navigate("apps")} />}
      {menu.element}
    </Section>
  );
}

export function AppsRow(_: RowProps) {
  const { apps } = useApps();
  const { data: windows } = useApi<WindowEntry[]>("/api/windows", ["windows"]);
  const launch = useLaunch();
  const list = (apps ?? []).filter((a) => a.provider === "linux");
  return (
    <Section title="My Apps" onTitle={() => navigate("apps")}>
      {apps === null && [1, 2, 3, 4].map((i) => <Skeleton key={i} h={92} w={300} />)}
      {list.slice(0, 10).map((a) => {
        const open = windows?.some((w) => w.appId === a.id);
        return <ItemCard key={a.id} icon={<AppIcon icon={a.icon} name={a.name} color={a.color} />} title={a.name} subtitle={a.comment || "App"} meta={<><Dot state={open ? "on" : "off"} /> {open ? "Open" : "Installed"}</>} onClick={() => launch(a.id)} />;
      })}
    </Section>
  );
}

export function WebAppsRow(_: RowProps) {
  const { apps } = useApps();
  const { data: windows } = useApi<WindowEntry[]>("/api/windows", ["windows"]);
  const launch = useLaunch();
  const list = (apps ?? []).filter((a) => a.provider === "web");
  return (
    <Section title="Web Apps" onTitle={() => navigate("apps", undefined, { filter: "web" })} link="Add" onLink={() => navigate("apps", undefined, { filter: "web", add: "1" })}>
      {list.map((a) => {
        const open = windows?.some((w) => w.appId === a.id);
        return <ItemCard key={a.id} icon={<AppIcon name={a.name} color={a.color} />} title={a.name} subtitle={a.comment} meta={<><Dot state={open ? "on" : "info"} /> {open ? "Open" : "Web app"}</>} onClick={() => launch(a.id)} />;
      })}
      {apps && list.length === 0 && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: "#0a84ff" }}><Globe size={26} /></span>} title="Add a web app" subtitle="Toast, Facebook, Gmail and more" meta={<Pill><Plus size={11} /> Add</Pill>} onClick={() => navigate("apps", undefined, { filter: "web", add: "1" })} />}
    </Section>
  );
}

export function PhoneRow(_: RowProps) {
  const { data: android } = useApi<AndroidStatus>("/api/android", ["android"]);
  const { apps } = useApps();
  const { data: windows } = useApi<WindowEntry[]>("/api/windows", ["windows"]);
  const launch = useLaunch();
  const dev = android?.devices.find((d) => d.state === "device");
  const pending = android?.devices.find((d) => d.state !== "device");
  const list = (apps ?? []).filter((a) => a.provider === "android");
  if (!android || (!android.available && !pending)) return null;
  return (
    <Section title={dev ? dev.model : "Your Phone"} onTitle={() => navigate("settings", "devices")} link={dev ? "All phone apps" : undefined} onLink={() => navigate("apps", undefined, { filter: "android" })}>
      {!dev && pending && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: "#ff9f0a" }}><Usb size={26} /></span>} title={pending.model} subtitle={pending.state === "unauthorized" ? "Tap “Allow” on the phone" : `Phone is ${pending.state}`} meta="Settings · Phone & Devices" badge={<Dot state="warn" />} onClick={() => navigate("settings", "devices")} />}
      {!dev && !pending && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: "#3ddc84" }}><Smartphone size={26} /></span>} title="Plug in a phone" subtitle="Its apps show up here" meta="USB debugging on" onClick={() => navigate("settings", "devices")} />}
      {list.slice(0, 10).map((a) => {
        const open = windows?.some((w) => w.appId === a.id);
        return <ItemCard key={a.id} icon={a.package === "__screen" ? <span className="app-icon" style={{ ["--ic" as string]: "#3ddc84" }}><Smartphone size={26} /></span> : <AppIcon name={a.name} color={a.color} />} title={a.name} subtitle={a.comment} meta={<><Dot state={open ? "on" : "off"} /> {open ? "On screen" : "Android"}</>} onClick={() => launch(a.id)} />;
      })}
    </Section>
  );
}

export function TodayRow(_: RowProps) {
  const { from, to } = todayRange();
  const { data: events } = useApi<CalendarEvent[]>(`/api/calendar?from=${from}&to=${to}`, ["calendar"]);
  return (
    <Section title="Today" onTitle={() => navigate("calendar")}>
      {(events ?? []).map((e) => <ItemCard key={e.id} icon={<span className="app-icon" style={{ ["--ic" as string]: e.color ?? "#0a84ff" }}><Calendar size={26} /></span>} title={e.title} subtitle={timeRange(e.start, e.end, e.allDay)} meta={e.location} onClick={() => navigate("calendar")} />)}
      {events && events.length === 0 && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: "#30d158" }}><Calendar size={26} /></span>} title="Nothing scheduled" subtitle="Enjoy the open day" onClick={() => navigate("calendar")} />}
    </Section>
  );
}

export function RecentFilesRow(_: RowProps) {
  const { data: recent } = useApi<FileEntry[]>("/api/files/recent");
  return (
    <Section title="Recent Files" onTitle={() => navigate("files", undefined, { path: "recent" })}>
      {(recent ?? []).map((f) => <ItemCard key={f.path} icon={<FileGlyph kind={f.kind} />} title={f.name} subtitle={`Edited ${timeAgo(f.modified)}`} meta={f.path} onClick={() => void api.post("/api/open", { target: f.path })} />)}
    </Section>
  );
}

export function AutomationsRow({ onJob }: RowProps) {
  const { data: autos } = useApi<{ items: Automation[]; templates: Omit<Automation, "id">[] }>("/api/automations", ["automations"]);
  const toast = useToast();
  const menu = useMenu();
  return (
    <Section title="Automations" onTitle={() => navigate("automations")}>
      {(autos?.items ?? []).map((a) => {
        const Icon = AUTOMATION_ICONS[a.icon] ?? Zap;
        return <ItemCard key={a.id} icon={<span className="app-icon" style={{ ["--ic" as string]: "#2b2f3a" }}><Icon size={26} /></span>} title={a.name} subtitle={a.description} meta={a.enabled ? <Pill color="green" dot>Active</Pill> : <Pill>Paused</Pill>} onClick={() => navigate("automations")} onMore={(e) => menu.open(e, [{ label: "Run now", icon: <Play size={14} />, onClick: () => void api.post<{ jobId?: string }>(`/api/automations/${a.id}/run`).then((r) => r.jobId && onJob(r.jobId)) }])} />;
      })}
      {autos && autos.items.length === 0 && autos.templates.slice(0, 6).map((t) => {
        const Icon = AUTOMATION_ICONS[t.icon] ?? Zap;
        return <ItemCard key={t.name} icon={<span className="app-icon" style={{ ["--ic" as string]: "#2b2f3a" }}><Icon size={26} /></span>} title={t.name} subtitle={t.description} meta={<Pill><Plus size={11} /> Add</Pill>} onClick={() => void api.post("/api/automations", t).then(() => toast(`Added ${t.name}`))} />;
      })}
      {menu.element}
    </Section>
  );
}
