import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpError } from "../router.js";
import { JsonStore, id } from "../store.js";
import { bus } from "../events.js";

/**
 * Connect-first app registry for NODE Hub (M1a).
 * Manifests live in config/app-manifests/*.json.
 * "Installed" means registered for this workspace — not container provisioning.
 * Install-and-operate (CasaOS/etc.) is deferred; do not invent container ops here.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_DIR = path.resolve(here, "../../../config/app-manifests");

export type FrontendKind = "native" | "embedded" | "integrated";

export interface AppManifest {
  id: string;
  name: string;
  version: string;
  publisher?: string;
  icon?: string;
  category?: string;
  source: { kind: string; url?: string; upstream?: string; module?: string };
  frontend: {
    kind: FrontendKind;
    entry?: string;
    nativeSlug?: string;
    doorApp?: string;
    screenId?: string;
  };
  backend?: { routePrefix?: string; upstream?: string };
  auth?: { mode?: string; tokenExchange?: string };
  permissions?: string[];
  tenancy?: { scope?: string };
  availability?: Record<string, string>;
  lifecycle?: Record<string, string>;
  notes?: string;
}

export interface InstalledApp {
  id: string;
  manifestId: string;
  installedAt: string;
  enabled: boolean;
  source: "connect-first" | "native-module";
  workspace?: string;
}

interface RegistryDoc {
  installed: InstalledApp[];
}

const store = new JsonStore<RegistryDoc>("hub-registry", () => ({ installed: [] }));

/** Milestone-1 allow-list: only Twenty + CyberCheck may be installed from the Hub store. */
export const M1_INSTALLABLE = new Set(["twenty", "cybercheck"]);

async function loadManifestFile(file: string): Promise<AppManifest | null> {
  try {
    const raw = JSON.parse(await readFile(path.join(MANIFEST_DIR, file), "utf8")) as AppManifest;
    if (!raw?.id || !raw?.name || !raw?.frontend?.kind) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function listManifests(): Promise<AppManifest[]> {
  let files: string[];
  try {
    files = (await readdir(MANIFEST_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: AppManifest[] = [];
  for (const f of files) {
    const m = await loadManifestFile(f);
    if (m) out.push(m);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getManifest(id: string): Promise<AppManifest | null> {
  const all = await listManifests();
  return all.find((m) => m.id === id) ?? null;
}

export async function listInstalled(): Promise<(InstalledApp & { manifest: AppManifest | null })[]> {
  const doc = await store.read();
  const manifests = await listManifests();
  const byId = new Map(manifests.map((m) => [m.id, m]));
  return doc.installed.map((i) => ({ ...i, manifest: byId.get(i.manifestId) ?? null }));
}

export async function isInstalled(manifestId: string): Promise<boolean> {
  const doc = await store.read();
  return doc.installed.some((i) => i.manifestId === manifestId && i.enabled);
}

/** Connect-first register: mark a running / native app as installed for the workspace. */
export async function registerInstalled(
  manifestId: string,
  opts: { workspace?: string; source?: InstalledApp["source"] } = {},
): Promise<InstalledApp & { manifest: AppManifest }> {
  if (!M1_INSTALLABLE.has(manifestId)) {
    throw new HttpError(400, `M1 App Store only installs: ${[...M1_INSTALLABLE].join(", ")}`);
  }
  const manifest = await getManifest(manifestId);
  if (!manifest) throw new HttpError(404, `Unknown manifest: ${manifestId}`);

  const doc = await store.read();
  const existing = doc.installed.find((i) => i.manifestId === manifestId);
  if (existing) {
    existing.enabled = true;
    if (opts.workspace) existing.workspace = opts.workspace;
    await store.write(doc);
    bus.emit("registry", { action: "enable", id: existing.id, manifestId });
    return { ...existing, manifest };
  }

  const entry: InstalledApp = {
    id: id(),
    manifestId,
    installedAt: new Date().toISOString(),
    enabled: true,
    source: opts.source ?? (manifest.frontend.kind === "native" ? "native-module" : "connect-first"),
    workspace: opts.workspace,
  };
  doc.installed.push(entry);
  await store.write(doc);
  bus.emit("registry", { action: "install", id: entry.id, manifestId });
  return { ...entry, manifest };
}

export async function unregisterInstalled(manifestId: string): Promise<{ ok: boolean; message: string }> {
  const doc = await store.read();
  const before = doc.installed.length;
  doc.installed = doc.installed.filter((i) => i.manifestId !== manifestId);
  if (doc.installed.length === before) return { ok: false, message: "Not installed" };
  await store.write(doc);
  bus.emit("registry", { action: "uninstall", manifestId });
  return { ok: true, message: `Unregistered ${manifestId}` };
}

export async function setEnabled(manifestId: string, enabled: boolean): Promise<InstalledApp> {
  const doc = await store.read();
  const entry = doc.installed.find((i) => i.manifestId === manifestId);
  if (!entry) throw new HttpError(404, `Not installed: ${manifestId}`);
  entry.enabled = enabled;
  await store.write(doc);
  bus.emit("registry", { action: enabled ? "enable" : "disable", manifestId });
  return entry;
}

/** Store catalog view: manifests + install state (M1 allow-list only). */
export async function storeCatalog(): Promise<
  Array<AppManifest & { installed: boolean; enabled: boolean; installable: boolean }>
> {
  const [manifests, installed] = await Promise.all([listManifests(), store.read()]);
  const map = new Map(installed.installed.map((i) => [i.manifestId, i]));
  return manifests
    .filter((m) => M1_INSTALLABLE.has(m.id))
    .map((m) => {
      const i = map.get(m.id);
      return {
        ...m,
        installed: Boolean(i),
        enabled: Boolean(i?.enabled),
        installable: M1_INSTALLABLE.has(m.id),
      };
    });
}
