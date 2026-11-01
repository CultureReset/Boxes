import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, useEvent } from "../api/client";
import type { Layout } from "../api/types";
import { applyTv, detectTv } from "../lib/tv";

interface Ctx {
  layout: Layout | null;
  tv: boolean;
  save: (patch: Partial<Layout>) => Promise<void>;
}

const LayoutCtx = createContext<Ctx>({ layout: null, tv: false, save: async () => {} });

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<Layout | null>(null);
  // The saved TV choice is for the big screen. A phone-width window is never a
  // TV: TV mode hides the bottom tab bar, which left phones with no way to
  // reach Apps, Agents, Files or Settings.
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 840px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 840px)");
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const tv = !narrow && (layout?.tv ?? detectTv());
  useEffect(() => {
    void api.get<Layout>("/api/layout").then(setLayout).catch(() => setLayout({ rows: [], look: "dashboard", tv: null, scale: 1, weatherLocation: "" }));
  }, []);
  useEvent<Layout>("layout", setLayout);
  useEvent("world", () => void api.get<Layout>("/api/layout").then(setLayout).catch(() => {}));
  useEffect(() => applyTv(tv, layout?.scale ?? 1), [tv, layout?.scale]);
  const save = async (patch: Partial<Layout>) => setLayout(await api.post<Layout>("/api/layout", patch));
  return <LayoutCtx.Provider value={{ layout, tv, save }}>{children}</LayoutCtx.Provider>;
}

export function useLayout() {
  return useContext(LayoutCtx);
}
