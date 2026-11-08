import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, useEvent } from "../api/client";
import type { Status } from "../api/types";

const StatusCtx = createContext<{ status: Status | null; reload: () => void }>({ status: null, reload: () => {} });

export function StatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const reload = () => void api.get<Status>("/api/status").then(setStatus).catch(() => {});
  useEffect(reload, []);
  useEvent<Status>("status", setStatus);
  useEvent<Status["audio"]>("audio", (audio) => setStatus((s) => (s ? { ...s, audio } : s)));
  useEvent<number>("brightness", (brightness) => setStatus((s) => (s ? { ...s, brightness } : s)));
  useEvent<Status["network"]>("network", (network) => setStatus((s) => (s ? { ...s, network } : s)));
  useEvent<Status["bluetooth"]>("bluetooth", (bluetooth) => setStatus((s) => (s ? { ...s, bluetooth } : s)));
  useEvent<{ theme: string; background: string | null }>("theme", (t) => setStatus((s) => (s ? { ...s, ...t } : s)));
  return <StatusCtx.Provider value={{ status, reload }}>{children}</StatusCtx.Provider>;
}

export function useStatus() {
  return useContext(StatusCtx);
}
