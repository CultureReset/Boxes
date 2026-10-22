import { JsonStore } from "../store.js";
import { WorldStore, activeWorld, saveWorld, type Look } from "./worlds.js";
import { bus } from "../events.js";
import { HttpError } from "../router.js";

/**
 * The home screen is a list of rows. Each row id maps to a widget in the
 * shell's row registry (shell/src/modules/homeRows.tsx). Users reorder and
 * toggle rows in Settings; new widgets only need a registry entry.
 */
export interface HomeRow {
  id: string;
  enabled: boolean;
}

export const DEFAULT_ROWS: HomeRow[] = [
  { id: "attention", enabled: true },
  { id: "continue", enabled: true },
  { id: "phone", enabled: true },
  { id: "apps", enabled: true },
  { id: "webapps", enabled: true },
  { id: "today", enabled: false },
  { id: "recent-files", enabled: false },
  { id: "automations", enabled: true },
];

export interface Layout {
  rows: HomeRow[]; // per world
  look: Look; // per world
  tv: boolean | null; // device-wide; null = auto-detect
  scale: number; // device-wide; 1 = default
  weatherLocation: string; // device-wide, e.g. "San Francisco"
}

const rowsStore = new WorldStore<{ rows: HomeRow[] }>("layout", () => ({ rows: DEFAULT_ROWS }));
const device = new JsonStore<{ tv: boolean | null; scale: number; weatherLocation: string }>("device", () => ({ tv: null, scale: 1, weatherLocation: "" }));

export async function getLayout(): Promise<Layout> {
  const [{ rows }, d, w] = await Promise.all([rowsStore.read(), device.read(), activeWorld()]);
  // Any row added to the defaults after the user's file was written shows up disabled at the end.
  const known = new Set(rows.map((r) => r.id));
  return { rows: [...rows, ...DEFAULT_ROWS.filter((r) => !known.has(r.id)).map((r) => ({ ...r, enabled: false }))], look: w.look, tv: d.tv, scale: d.scale, weatherLocation: d.weatherLocation };
}

export async function setLayout(input: Partial<Layout>): Promise<Layout> {
  const current = await getLayout();
  if (Array.isArray(input.rows)) {
    const rows = input.rows.filter((r): r is HomeRow => Boolean(r) && typeof r.id === "string" && /^[a-z0-9-]{1,32}$/.test(r.id)).map((r) => ({ id: r.id, enabled: Boolean(r.enabled) }));
    if (rows.length === 0) throw new HttpError(400, "At least one row is required");
    await rowsStore.write({ rows });
  }
  if (input.look && ["dashboard", "living", "cinema"].includes(input.look)) await saveWorld({ id: (await activeWorld()).id, look: input.look });
  const scale = typeof input.scale === "number" && input.scale >= 0.8 && input.scale <= 1.6 ? input.scale : current.scale;
  const tv = input.tv === undefined ? current.tv : input.tv === null ? null : Boolean(input.tv);
  const weatherLocation = typeof input.weatherLocation === "string" ? input.weatherLocation.slice(0, 80) : current.weatherLocation;
  await device.write({ tv, scale, weatherLocation });
  const next = await getLayout();
  bus.emit("layout", next);
  return next;
}
