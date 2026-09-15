import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, useEvent } from "../api/client";
import type { World } from "../api/types";

interface Ctx {
  worlds: World[];
  active: World | null;
  reload: () => Promise<void>;
  /** Returns "pin" when the target world asks for one. */
  switchTo: (id: string, pin?: string) => Promise<"ok" | "pin" | "wrong">;
}

const WorldCtx = createContext<Ctx>({ worlds: [], active: null, reload: async () => {}, switchTo: async () => "ok" });

export function WorldProvider({ children }: { children: ReactNode }) {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const reload = async () => {
    try {
      const r = await api.get<{ active: string; worlds: World[] }>("/api/worlds");
      setWorlds(r.worlds);
      setActiveId(r.active);
    } catch {
      /* daemon offline: shell still renders */
    }
  };
  useEffect(() => void reload(), []);
  useEvent<{ active: string }>("world", () => void reload());
  const switchTo = async (id: string, pin?: string): Promise<"ok" | "pin" | "wrong"> => {
    try {
      await api.post("/api/worlds/switch", { id, pin });
      await reload();
      return "ok";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return /PIN required/.test(msg) ? "pin" : "wrong";
    }
  };
  const active = worlds.find((w) => w.id === activeId) ?? null;
  return <WorldCtx.Provider value={{ worlds, active, reload, switchTo }}>{children}</WorldCtx.Provider>;
}

export function useWorld() {
  return useContext(WorldCtx);
}
