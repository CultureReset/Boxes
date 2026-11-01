/** node-door: the ONE login for NODE. The daemon serves it same-origin at /door/*
 *  (a plain reverse-proxy route), so its session cookie is first-party here.
 *  Every app's data comes from the PC through the door's /app/<name>/ API,
 *  which injects that app's credentials server-side. */
export const DOOR = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_DOOR_URL) ?? "/door";

export interface DoorMe { ok: boolean; user: { id: number; email: string; role: string }; via: string; linked_apps: string[] }

async function j<T>(r: Response): Promise<T> {
  const t = await r.text();
  let d: unknown = null;
  try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  if (!r.ok) {
    if (r.status === 401) window.dispatchEvent(new Event("node:signed-out"));
    throw new Error((d as { error?: string } | null)?.error ?? `${r.status}`);
  }
  return d as T;
}
export const door = {
  me: () => fetch(DOOR + "/me", { credentials: "include" }).then((r) => (r.status === 401 ? null : j<DoorMe>(r))),
  post: <T>(p: string, b: unknown) => fetch(DOOR + p, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => j<T>(r)),
  app: <T>(name: string, p: string) => fetch(`${DOOR}/app/${name}${p}`, { credentials: "include" }).then((r) => j<T>(r)),
  appText: (name: string, p: string) => fetch(`${DOOR}/app/${name}${p}`, { credentials: "include" }).then(async (r) => { if (!r.ok) await j(r); return r.text(); }),
  appUrl: (name: string, p: string) => `${DOOR}/app/${name}${p}`,
  logout: () => fetch(DOOR + "/auth/logout", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: "{}" }),
};
