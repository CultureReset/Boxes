import type { ComponentType } from "react";
import { Home as HomeIcon, LayoutGrid, Sparkles, Zap, Folder, Calendar as CalendarIcon, Settings as SettingsIcon } from "lucide-react";
import { Home } from "../screens/Home";
import { Apps } from "../screens/Apps";
import { Agents } from "../screens/Agents";
import { Automations } from "../screens/Automations";
import { Files } from "../screens/Files";
import { Calendar } from "../screens/Calendar";
import { Settings } from "../screens/settings/Settings";

export interface ScreenProps {
  sub?: string;
  params: URLSearchParams;
  onJob: (id: string) => void;
}

export interface ScreenModule {
  id: string;
  title: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  component: ComponentType<ScreenProps>;
  /** Shown in the top navigation (desktop) */
  nav: boolean;
  /** Shown in the phone tab bar */
  tab: boolean;
  /** Ask bar placeholder; omit to hide the ask bar on this screen */
  ask?: string;
}

/**
 * Every screen in NODE is a module. Add one here and it appears in the
 * navigation, the phone tab bar and the router. Remove one and it is gone
 * everywhere. Screens receive the same props and never import each other.
 */
export const SCREENS: ScreenModule[] = [
  { id: "home", title: "Home", icon: HomeIcon, component: Home, nav: true, tab: true, ask: "What do you need?" },
  { id: "apps", title: "Apps", icon: LayoutGrid, component: Apps, nav: true, tab: true, ask: "What would you like to open?" },
  { id: "agents", title: "Agents", icon: Sparkles, component: Agents, nav: true, tab: true, ask: "What do you need?" },
  { id: "automations", title: "Automations", icon: Zap, component: Automations, nav: true, tab: false, ask: "Describe something to automate…" },
  { id: "files", title: "Files", icon: Folder, component: (p) => <Files path={p.params.get("path") ?? "~"} />, nav: true, tab: true, ask: "Find or organize a file…" },
  { id: "calendar", title: "Calendar", icon: CalendarIcon, component: () => <Calendar />, nav: false, tab: false },
  { id: "settings", title: "Settings", icon: SettingsIcon, component: (p) => <Settings panel={p.sub} onJob={p.onJob} />, nav: false, tab: true },
];

export function screen(id: string): ScreenModule {
  return SCREENS.find((s) => s.id === id) ?? SCREENS[0];
}
