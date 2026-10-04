import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, useEvent } from "../api/client";
import type { NextgentState } from "../api/nextgent";

interface Ctx {
  state: NextgentState | null;
  /** The daemon answered at least once (state may still say "not configured"). */
  loaded: boolean;
  reload: () => void;
}

const NextgentCtx = createContext<Ctx>({ state: null, loaded: false, reload: () => {} });

/**
 * Who this computer is in the cloud: paired or not, which company, whether
 * the cloud is reachable right now. Refreshed on the daemon's "nextgent" event
 * and every half minute, so "offline" appears without anyone touching the remote.
 */
export function NextgentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NextgentState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reload = () =>
    void api
      .get<NextgentState>("/api/nextgent")
      .then(setState)
      .catch(() => {})
      .finally(() => setLoaded(true));
  useEffect(() => {
    reload();
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, []);
  useEvent("nextgent", reload);
  return <NextgentCtx.Provider value={{ state, loaded, reload }}>{children}</NextgentCtx.Provider>;
}

export function useNextgent() {
  return useContext(NextgentCtx);
}

/** The name the screen goes by: the configured brand, else the business. */
export function useBrand(): string {
  const { state } = useNextgent();
  return state?.brand || state?.company?.name || "";
}
