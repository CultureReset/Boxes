import type { ComponentType } from "react";
import { AttentionRow, ContinueRow, AppsRow, WebAppsRow, PhoneRow, TodayRow, RecentFilesRow, AutomationsRow } from "../screens/homeRows";

export interface RowProps {
  onJob: (id: string) => void;
}

export interface HomeRowModule {
  id: string;
  title: string;
  description: string;
  component: ComponentType<RowProps>;
}

/**
 * Widgets available on the home screen. The order and on/off state live in
 * the daemon's layout store and are edited in Settings → Home Screen.
 * A new widget is one entry here plus a component.
 */
export const HOME_ROWS: HomeRowModule[] = [
  { id: "attention", title: "Needs Attention", description: "Notifications, next meeting, updates, low battery", component: AttentionRow },
  { id: "continue", title: "Continue", description: "Open apps and recent files", component: ContinueRow },
  { id: "phone", title: "Your Phone", description: "Apps on the phone plugged in over USB", component: PhoneRow },
  { id: "apps", title: "My Apps", description: "Installed apps", component: AppsRow },
  { id: "webapps", title: "Web Apps", description: "Toast, Facebook, Gmail and other sites as apps", component: WebAppsRow },
  { id: "today", title: "Today", description: "Today's calendar", component: TodayRow },
  { id: "recent-files", title: "Recent Files", description: "Files you touched recently", component: RecentFilesRow },
  { id: "automations", title: "Automations", description: "Scheduled helpers", component: AutomationsRow },
];

export function homeRow(id: string): HomeRowModule | undefined {
  return HOME_ROWS.find((r) => r.id === id);
}
