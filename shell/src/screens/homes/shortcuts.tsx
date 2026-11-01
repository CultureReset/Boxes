import { openApp, showAppView } from "../../lib/openApp";
import type { AppEntry } from "../../api/types";
import { api } from "../../api/client";
import type { Shortcut } from "../../api/types";
import { useWorld } from "../../state/world";
import { useToast } from "../../state/toast";
import { navigate } from "../../lib/router";
import { iconFor } from "../../lib/icons";
import { askWith } from "../Agents";

export function ShortcutIcon({ name, size }: { name: string; size: number }) {
  const Icon = iconFor(name);
  return <Icon size={size} strokeWidth={2.2} />;
}

/** Shortcuts are the big icons / colour tiles; each world has its own list. */
export function useShortcuts() {
  const { active, switchTo } = useWorld();
  const toast = useToast();
  const run = (s: Shortcut) => {
    const { type, target } = s.action;
    if (type === "screen") {
      const [screen, sub] = target.split("/");
      navigate(screen, sub);
    } else if (type === "app") void api.get<AppEntry[]>("/api/apps").then((l) => { const a = l.find((x) => x.id === target); if (a) return openApp(a, toast); return api.post<{ ok: boolean; message: string }>("/api/apps/launch", { id: target }).then((r) => toast(r.message, r.ok ? "ok" : "error")); });
    else if (type === "url") showAppView({ kind: "web", url: target, title: new URL(target).host });
    else if (type === "agent") askWith(target);
    else if (type === "world") void switchTo(target).then((r) => (r === "pin" ? navigate("settings", "worlds") : r === "wrong" ? toast("Locked", "error") : navigate("home")));
  };
  return { run, shortcuts: active?.shortcuts ?? [] };
}
