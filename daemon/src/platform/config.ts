import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { secret, businessName } from "../mode.js";

/**
 * Where the box is pointed, and who it is.
 *
 * One file, one shape. The owner never edits it — setup writes it and the
 * Settings screen changes it. Environment variables win over the file so a
 * developer can point a laptop at staging without touching the box's config.
 */
export interface PlatformConfig {
  /** Base URL of the platform API. The box never talks to a database. */
  baseUrl: string;
  /** Session token issued to this box. Scoped to one business. */
  token: string;
  /** The business this box belongs to. Resolved from the token server-side;
   *  held here only so the UI can render a name before the first call. */
  slug: string;
  businessName: string;
}

const DIR = path.join(os.homedir(), ".config", "nodeos");
const FILE = path.join(DIR, "platform.json");

const EMPTY: PlatformConfig = { baseUrl: "", token: "", slug: "", businessName: "" };

let cached: PlatformConfig | null = null;

export async function platformConfig(): Promise<PlatformConfig> {
  if (cached) return cached;
  let onDisk: Partial<PlatformConfig> = {};
  try {
    onDisk = JSON.parse(await readFile(FILE, "utf8")) as Partial<PlatformConfig>;
  } catch {
    /* not configured yet — that is a normal state, not an error */
  }
  cached = {
    baseUrl: process.env.NODEOS_API_URL ?? onDisk.baseUrl ?? EMPTY.baseUrl,
    // NODEOS_API_TOKEN, or the file named by NODEOS_API_TOKEN_FILE (a mounted secret).
    token: secret("NODEOS_API_TOKEN") ?? onDisk.token ?? EMPTY.token,
    slug: process.env.NODEOS_SLUG ?? onDisk.slug ?? EMPTY.slug,
    businessName: onDisk.businessName ?? (businessName() || EMPTY.businessName),
  };
  return cached;
}

export async function savePlatformConfig(next: Partial<PlatformConfig>): Promise<PlatformConfig> {
  const merged = { ...(await platformConfig()), ...next };
  await mkdir(DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(merged, null, 2) + "\n", { mode: 0o600 });
  cached = merged;
  return merged;
}

/** True when this box knows where its platform is. Everything above checks this
 *  and degrades to local-only rather than throwing. */
export async function isConnected(): Promise<boolean> {
  const c = await platformConfig();
  return Boolean(c.baseUrl && c.token);
}
