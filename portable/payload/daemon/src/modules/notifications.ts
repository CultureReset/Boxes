import { spawn } from "node:child_process";
import { has, run } from "../exec.js";
import { bus } from "../events.js";
import { id } from "../store.js";

export interface Notification {
  id: string;
  app: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
}

const history: Notification[] = [];
const MAX = 100;

export function listNotifications(): Notification[] {
  return history;
}

export function push(n: Omit<Notification, "id" | "at" | "read">): Notification {
  const full: Notification = { ...n, id: id(), at: new Date().toISOString(), read: false };
  history.unshift(full);
  if (history.length > MAX) history.pop();
  bus.emit("notification", full);
  return full;
}

export function markRead(ids: string[] | "all"): void {
  for (const n of history) if (ids === "all" || ids.includes(n.id)) n.read = true;
  bus.emit("notifications", history);
}

export function clearAll(): void {
  history.length = 0;
  bus.emit("notifications", history);
}

/** Send a real desktop notification through whatever the session has. */
export async function sendDesktop(title: string, body: string): Promise<void> {
  if (await has("omarchy-notification-send")) await run("omarchy-notification-send", [title, body]);
  else if (await has("notify-send")) await run("notify-send", [title, body]);
  push({ app: "NODE", title, body });
}

/**
 * Mirror every notification on the session bus into NODE's history so the
 * shell can show a notification centre without replacing the system server.
 * Uses dbus-monitor (works without eavesdrop privileges on modern D-Bus).
 */
export async function watchDbus(): Promise<void> {
  if (!(await has("dbus-monitor")) || !process.env.DBUS_SESSION_BUS_ADDRESS) return;
  const child = spawn("dbus-monitor", ["--session", "interface='org.freedesktop.Notifications',member='Notify'"], { stdio: ["ignore", "pipe", "ignore"] });
  child.on("error", () => {});
  child.unref();
  let block: string[] = [];
  const flush = () => {
    const strings = block.filter((l) => l.trim().startsWith("string ")).map((l) => l.trim().slice(7).replace(/^"|"$/g, ""));
    // Notify(app_name, replaces_id, app_icon, summary, body, actions, hints, timeout)
    if (strings.length >= 4) push({ app: strings[0] || "System", title: strings[2] || strings[1] || "", body: strings[3] || "" });
    block = [];
  };
  let buf = "";
  child.stdout.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.startsWith("method call")) {
        if (block.length) flush();
        block = [line];
      } else if (block.length) block.push(line);
    }
  });
}
