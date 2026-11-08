import { JsonStore, id as newId } from "../store.js";
import { bus } from "../events.js";
import { HttpError } from "../router.js";

/**
 * Worlds: one identity, many fully separated environments.
 *
 * A world is a person (Emma, Dad, Liam) or a context (Personal, Family,
 * Business, Work, Public). Each world has its own look, its own set of apps
 * and agents, and its own data: calendar, automations, web apps and home
 * layout are stored per world (see worldStore below), so nothing mixes.
 * Switching is instant and everything on screen follows.
 */
export type WorldKind = "personal" | "family" | "business" | "work" | "public" | "person";
export type Look = "dashboard" | "living" | "cinema";

export interface Shortcut {
  id: string;
  label: string;
  icon: string; // lucide icon name
  color: string;
  action: { type: "screen" | "app" | "agent" | "world" | "url"; target: string };
}

export interface World {
  id: string;
  name: string;
  kind: WorldKind;
  color: string;
  tagline: string;
  look: Look;
  /** App ids allowed in this world; null = everything. */
  apps: string[] | null;
  /** Agent persona ids allowed in this world; null = everything. */
  agents: string[] | null;
  shortcuts: Shortcut[];
  /** Optional 4-8 digit PIN asked before switching in (kept in the clear: this is a convenience lock, not security). */
  pin?: string;
}

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: "today", label: "Today", icon: "calendar", color: "#ff453a", action: { type: "screen", target: "calendar" } },
  { id: "family", label: "Family", icon: "users", color: "#30d158", action: { type: "world", target: "family" } },
  { id: "music", label: "Music", icon: "music", color: "#ff2d55", action: { type: "agent", target: "music" } },
  { id: "travel", label: "Travel", icon: "plane", color: "#0a84ff", action: { type: "agent", target: "travel" } },
  { id: "work", label: "Work", icon: "briefcase", color: "#5e5ce6", action: { type: "world", target: "business" } },
  { id: "files", label: "Files", icon: "folder", color: "#0a84ff", action: { type: "screen", target: "files" } },
  { id: "home", label: "Home", icon: "home", color: "#ff9f0a", action: { type: "screen", target: "settings" } },
  { id: "apps", label: "Apps", icon: "grid", color: "#636e7b", action: { type: "screen", target: "apps" } },
];

function defaults(): { active: string; worlds: World[] } {
  return {
    active: "personal",
    worlds: [
      { id: "personal", name: "Personal", kind: "personal", color: "#0a84ff", tagline: "Your life, your rules.", look: "dashboard", apps: null, agents: null, shortcuts: DEFAULT_SHORTCUTS },
      { id: "family", name: "Family", kind: "family", color: "#30d158", tagline: "Shared with family.", look: "living", apps: null, agents: ["general", "booking", "health", "music", "travel", "shopping", "files"], shortcuts: DEFAULT_SHORTCUTS.filter((s) => s.id !== "work").map((s) => (s.id === "family" ? { ...s, label: "Everyone", action: { type: "screen", target: "settings/worlds" } } : s)) },
      { id: "business", name: "Business", kind: "business", color: "#ff9f0a", tagline: "Your company.", look: "dashboard", apps: null, agents: ["general", "email", "booking", "social", "finance", "research", "browser", "verification", "business", "developer", "files"], shortcuts: [
        { id: "email", label: "Email", icon: "mail", color: "#ea4335", action: { type: "agent", target: "email" } },
        { id: "finance", label: "Finance", icon: "bar-chart", color: "#30d158", action: { type: "agent", target: "finance" } },
        { id: "social", label: "Social", icon: "share", color: "#0a84ff", action: { type: "agent", target: "social" } },
        { id: "team", label: "Team", icon: "users", color: "#bf5af2", action: { type: "world", target: "work" } },
        { id: "docs", label: "Documents", icon: "folder", color: "#ff9f0a", action: { type: "screen", target: "files" } },
        { id: "apps", label: "Apps", icon: "grid", color: "#636e7b", action: { type: "screen", target: "apps" } },
      ] },
      { id: "work", name: "Employee", kind: "work", color: "#bf5af2", tagline: "Work environment.", look: "cinema", apps: null, agents: ["general", "email", "booking", "research", "browser", "files"], shortcuts: DEFAULT_SHORTCUTS.slice(0, 4).map((s) => (s.id === "family" ? { ...s, label: "Back", icon: "log-out", color: "#636e7b", action: { type: "world", target: "personal" } } : s)) },
      { id: "public", name: "Customer", kind: "public", color: "#ff453a", tagline: "Limited, controlled access.", look: "living", apps: [], agents: ["general"], shortcuts: [
        { id: "help", label: "Support", icon: "help-circle", color: "#ff453a", action: { type: "agent", target: "general" } },
        { id: "info", label: "Information", icon: "megaphone", color: "#0a84ff", action: { type: "agent", target: "general" } },
        { id: "back", label: "Owner", icon: "lock", color: "#636e7b", action: { type: "world", target: "personal" } },
      ] },
    ],
  };
}

const store = new JsonStore<{ active: string; worlds: World[] }>("worlds", defaults);

export async function listWorlds(): Promise<{ active: string; worlds: Omit<World, "pin">[] & { locked?: boolean }[] }> {
  const s = await store.read();
  return { active: s.active, worlds: s.worlds.map(({ pin, ...w }) => ({ ...w, locked: Boolean(pin) })) };
}

export async function activeWorldId(): Promise<string> {
  return (await store.read()).active;
}

export async function activeWorld(): Promise<World> {
  const s = await store.read();
  return s.worlds.find((w) => w.id === s.active) ?? s.worlds[0];
}

export async function switchWorld(id: string, pin?: string): Promise<World> {
  const s = await store.read();
  const w = s.worlds.find((x) => x.id === id);
  if (!w) throw new HttpError(404, "World not found");
  if (w.pin && w.pin !== pin) throw new HttpError(403, pin ? "Wrong PIN" : "PIN required");
  await store.write({ ...s, active: id });
  bus.emit("world", { active: id });
  return w;
}

export async function saveWorld(input: Partial<World>): Promise<World> {
  const s = await store.read();
  const existing = input.id ? s.worlds.find((w) => w.id === input.id) : undefined;
  if (!input.name?.trim() && !existing) throw new HttpError(400, "name is required");
  const id = existing?.id ?? (input.id && /^[a-z0-9-]{1,32}$/.test(input.id) ? input.id : input.name!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || newId());
  if (!existing && s.worlds.some((w) => w.id === id)) throw new HttpError(409, "A world with that name exists");
  const pin = input.pin === undefined ? existing?.pin : input.pin ? String(input.pin).replace(/\D/g, "").slice(0, 8) || undefined : undefined;
  const w: World = {
    id,
    name: (input.name ?? existing?.name ?? id).slice(0, 40),
    kind: input.kind ?? existing?.kind ?? "person",
    color: input.color ?? existing?.color ?? "#0a84ff",
    tagline: (input.tagline ?? existing?.tagline ?? "").slice(0, 80),
    look: input.look ?? existing?.look ?? "dashboard",
    apps: input.apps === undefined ? (existing?.apps ?? null) : input.apps,
    agents: input.agents === undefined ? (existing?.agents ?? null) : input.agents,
    shortcuts: (input.shortcuts ?? existing?.shortcuts ?? DEFAULT_SHORTCUTS).slice(0, 16),
    pin,
  };
  await store.write({ ...s, worlds: existing ? s.worlds.map((x) => (x.id === id ? w : x)) : [...s.worlds, w] });
  bus.emit("world", { active: s.active, changed: id });
  return w;
}

export async function deleteWorld(id: string): Promise<void> {
  const s = await store.read();
  if (s.worlds.length <= 1) throw new HttpError(400, "Keep at least one world");
  const worlds = s.worlds.filter((w) => w.id !== id);
  await store.write({ active: s.active === id ? worlds[0].id : s.active, worlds });
  bus.emit("world", { active: s.active === id ? worlds[0].id : s.active, removed: id });
}

/**
 * A store whose file depends on the active world. The first world keeps the
 * plain file name so data from before worlds existed is still there.
 */
export class WorldStore<T> {
  private stores = new Map<string, JsonStore<T>>();
  constructor(private name: string, private initial: () => T) {}

  private forWorld(worldId: string): JsonStore<T> {
    let s = this.stores.get(worldId);
    if (!s) {
      s = new JsonStore<T>(worldId === "personal" ? this.name : `${this.name}.${worldId}`, this.initial);
      this.stores.set(worldId, s);
    }
    return s;
  }

  async current(): Promise<JsonStore<T>> {
    return this.forWorld(await activeWorldId());
  }

  async read(): Promise<T> {
    return (await this.current()).read();
  }
  async write(v: T): Promise<void> {
    return (await this.current()).write(v);
  }
  async update(fn: (c: T) => T): Promise<T> {
    return (await this.current()).update(fn);
  }
  /** Every world's copy, for background work such as the automation scheduler. */
  async all(): Promise<Array<{ worldId: string; store: JsonStore<T> }>> {
    const s = await store.read();
    return s.worlds.map((w) => ({ worldId: w.id, store: this.forWorld(w.id) }));
  }
}
