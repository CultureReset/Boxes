import { useEffect, useState } from "react";
import { LogOut, Lock, Moon, Power, RefreshCw, Settings as SettingsIcon, Users } from "lucide-react";
import { useRoute, navigate } from "./lib/router";
import { StatusProvider } from "./state/status";
import { ToastProvider, useToast } from "./state/toast";
import { api, useApi, useConnected, useEvent } from "./api/client";
import type { AgentsInfo, Notification } from "./api/types";
import { TopBar } from "./components/TopBar";
import { DemoBanner } from "./components/DemoBanner";
import { TabBar } from "./components/TabBar";
import { AskBar } from "./components/AskBar";
import { SearchOverlay } from "./components/SearchOverlay";
import { NotificationsPanel } from "./components/NotificationsPanel";
import { JobPanel } from "./components/JobPanel";
import { Sheet } from "./components/Sheet";
import { useMenu } from "./components/Menu";
import { screen as screenModule } from "./modules/registry";
import { LayoutProvider, useLayout } from "./state/layout";
import { WorldProvider, useWorld } from "./state/world";
import { initSpatialNavigation, focusFirst } from "./lib/spatial";

function Shell() {
  const route = useRoute();
  const online = useConnected();
  const { layout } = useLayout();
  const { worlds, active: world, switchTo } = useWorld();
  const toast = useToast();
  const menu = useMenu();
  const [search, setSearch] = useState(false);
  const [notifs, setNotifs] = useState(false);
  const [job, setJob] = useState<string | null>(null);
  const [power, setPower] = useState(false);
  const [persona, setPersona] = useState("auto");
  const { data: agents } = useApi<AgentsInfo>("/api/agents", ["world"]);
  const { data: notifList } = useApi<Notification[]>("/api/notifications", ["notification", "notifications"]);
  const unread = (notifList ?? []).filter((n) => !n.read).length;

  useEvent<Notification>("notification", (n) => toast(`${n.title || n.app}${n.body ? ` — ${n.body}` : ""}`, "info"));
  useEffect(() => {
    const onAsk = (e: Event) => {
      setPersona((e as CustomEvent<{ persona: string }>).detail.persona);
      document.querySelector<HTMLInputElement>(".askbar input")?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setNotifs(false);
      }
    };
    window.addEventListener("node:ask", onAsk);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("node:ask", onAsk);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  useEffect(() => {
    document.querySelector(".main")?.scrollTo({ top: 0 });
  }, [route.screen, route.sub]);
  useEffect(() => {
    const look = layout?.look ?? "dashboard";
    document.documentElement.classList.remove("look-dashboard", "look-living", "look-cinema");
    document.documentElement.classList.add(`look-${look}`);
  }, [layout?.look]);

  // Remote / D-pad navigation. Back closes the topmost sheet, then walks history.
  useEffect(
    () =>
      initSpatialNavigation({
        onBack: () => {
          const layer = document.querySelector<HTMLElement>(".backdrop:last-of-type .close, .menu");
          if (layer) {
            (layer.classList.contains("menu") ? window : layer).dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            layer.click?.();
            return true;
          }
          if (route.screen !== "home") {
            history.length > 1 ? history.back() : navigate("home");
            return true;
          }
          return false;
        },
      }),
    [route.screen],
  );
  useEffect(() => {
    if (document.documentElement.classList.contains("tv")) setTimeout(() => focusFirst(), 50);
  }, [route.screen]);

  const screen = route.screen;
  const mod = screenModule(screen);
  const Screen = mod.component;
  const showAsk = Boolean(mod.ask);
  const userMenu = (e: React.MouseEvent) =>
    menu.open(e, [
      ...worlds.map((w) => ({
        label: w.name,
        icon: <span className="status-dot" style={{ background: w.color, width: 10, height: 10, boxShadow: w.id === world?.id ? `0 0 0 2px var(--bg), 0 0 0 3px ${w.color}` : undefined }} />,
        onClick: () => void switchTo(w.id).then((r) => (r === "pin" ? navigate("settings", "worlds") : r === "wrong" ? toast("Locked", "error") : navigate("home"))),
      })),
      { label: "People & Worlds", icon: <Users size={14} />, onClick: () => navigate("settings", "worlds") },
      { label: "Settings", icon: <SettingsIcon size={14} />, onClick: () => navigate("settings") },
      { label: "", divider: true },
      { label: "Lock", icon: <Lock size={14} />, onClick: () => void api.post("/api/power", { action: "lock" }) },
      { label: "Sleep", icon: <Moon size={14} />, onClick: () => void api.post("/api/power", { action: "sleep" }) },
      { label: "Restart…", icon: <RefreshCw size={14} />, onClick: () => setPower(true) },
      { label: "Shut Down…", icon: <Power size={14} />, onClick: () => setPower(true) },
      { label: "Log Out", icon: <LogOut size={14} />, danger: true, onClick: () => void api.post("/api/power", { action: "logout" }) },
    ]);

  return (
    <div className="frame">
      <TopBar active={screen} onSearch={() => setSearch(true)} onNotifications={() => setNotifs(true)} unread={unread} onUser={userMenu} />
      <DemoBanner />
      <main className={`main${showAsk ? "" : " no-ask"}`} key={`${screen}:${world?.id ?? ""}`}>
        <div className="fade-in">
          <Screen sub={route.sub} params={route.params} onJob={setJob} />
        </div>
      </main>
      {showAsk && <AskBar placeholder={mod.ask ?? "What do you need?"} personas={agents?.personas} persona={persona} onPersona={setPersona} onJob={setJob} online={online} />}
      <TabBar active={screen} />
      {search && <SearchOverlay onClose={() => setSearch(false)} />}
      {notifs && <NotificationsPanel onClose={() => setNotifs(false)} />}
      {job && <JobPanel jobId={job} onClose={() => setJob(null)} />}
      {power && (
        <Sheet title="Power" icon={<Power size={18} />} onClose={() => setPower(false)} size="narrow">
          <div className="list">
            {[
              { a: "restart", l: "Restart", I: RefreshCw, c: "#ff9f0a" },
              { a: "shutdown", l: "Shut Down", I: Power, c: "#ff453a" },
            ].map(({ a, l, I, c }) => (
              <button key={a} type="button" className="list-row" onClick={() => void api.post<{ ok: boolean; message: string }>("/api/power", { action: a }).then((r) => { toast(r.message, r.ok ? "ok" : "error"); setPower(false); })}>
                <span className="ic" style={{ ["--ic" as string]: c }}><I size={18} /></span>
                <span className="t grow">{l}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {menu.element}
    </div>
  );
}

export default function App() {
  return (
    <StatusProvider>
      <WorldProvider>
        <LayoutProvider>
          <ToastProvider>
            <Shell />
          </ToastProvider>
        </LayoutProvider>
      </WorldProvider>
    </StatusProvider>
  );
}
