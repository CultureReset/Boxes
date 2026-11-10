import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Portable NODE config. Values come from the environment, an optional .env
 * file, ${HOME}/${NODE_DATA}/${NODE_HOST}, or (when enabled) a live Tailscale
 * probe. Nothing in this module names a person, a box, a tailnet, or a path
 * under /home/<user>.
 */

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const t = line.startsWith("export ") ? line.slice(7) : line;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

function envSearchPaths(): string[] {
  const home = os.homedir();
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
  return [
    process.env.NODEOS_ENV_FILE,
    process.env.NODE_KIT_ROOT && path.join(process.env.NODE_KIT_ROOT, ".env"),
    path.join(process.cwd(), ".env"),
    path.join(xdg, "nodeos", ".env"),
  ].filter((p): p is string => Boolean(p));
}

/** Load .env files without overriding variables already set in the process. */
export function loadEnvFile(): void {
  for (const file of envSearchPaths()) {
    if (!existsSync(file)) continue;
    try {
      const parsed = parseEnvFile(readFileSync(file, "utf8"));
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
    } catch {
      /* ignore unreadable env files */
    }
  }
}

loadEnvFile();

export const HOME = os.homedir();
export const NODE_DATA =
  process.env.NODE_DATA ??
  process.env.NODEOS_DATA_DIR ??
  path.join(process.env.XDG_DATA_HOME ?? path.join(HOME, ".local/share"), "nodeos");
export const NODE_HOST = process.env.NODE_HOST ?? process.env.NODEOS_HOST ?? "127.0.0.1";
export const NODEOS_PORT = Number(process.env.NODEOS_PORT ?? 7770);
export const DOOR_PORT = Number(process.env.DOOR_PORT ?? process.env.NODEOS_DOOR_PORT ?? 7700);
export const HUB_PORT = Number(process.env.HUB_PORT ?? process.env.NODEOS_HUB_PORT ?? 7790);
export const DOOR_PUBLIC_PORT = Number(process.env.NODEOS_DOOR_PUBLIC_PORT ?? 10000);
export const NODE_SERVE_PORT = Number(process.env.NODEOS_SERVE_PORT ?? 14443);

let tailnetCache: string | undefined;
let tailIpCache: string | undefined;

function detectEnabled(): boolean {
  return process.env.NODEOS_DETECT_TAILSCALE !== "0";
}

function probeTailscale(): { host: string; ip: string } {
  const empty = { host: "", ip: "" };
  if (!detectEnabled()) return empty;
  try {
    const raw = execFileSync("tailscale", ["status", "--json"], { encoding: "utf8", timeout: 2500, stdio: ["ignore", "pipe", "ignore"] });
    const j = JSON.parse(raw) as { Self?: { DNSName?: string; TailscaleIPs?: string[] } };
    const host = (j.Self?.DNSName ?? "").replace(/\.$/, "");
    const ip = (j.Self?.TailscaleIPs ?? []).find((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x)) ?? "";
    return { host, ip };
  } catch {
    return empty;
  }
}

/** MagicDNS hostname, or empty when Tailscale is off or detection is disabled. */
export function tailnetHostname(): string {
  if (process.env.NODEOS_TAILNET_HOSTNAME) return process.env.NODEOS_TAILNET_HOSTNAME;
  if (process.env.TAILNET_HOSTNAME) return process.env.TAILNET_HOSTNAME;
  if (tailnetCache !== undefined) return tailnetCache;
  tailnetCache = probeTailscale().host;
  return tailnetCache;
}

/** Tailscale IPv4, or empty when unavailable. */
export function tailscaleIp(): string {
  if (process.env.NODEOS_TAILSCALE_IP) return process.env.NODEOS_TAILSCALE_IP;
  if (process.env.TAILSCALE_IP) return process.env.TAILSCALE_IP;
  if (tailIpCache !== undefined) return tailIpCache;
  tailIpCache = probeTailscale().ip;
  return tailIpCache;
}

export function publicScheme(): string {
  return process.env.NODE_PUBLIC_SCHEME ?? (tailnetHostname() ? "https" : "http");
}

export function publicHost(): string {
  return process.env.NODE_PUBLIC_HOST ?? (tailnetHostname() || "127.0.0.1");
}

/** Scheme + host, no trailing slash or port. Used to build per-service URLs. */
export function publicUrlBase(): string {
  if (process.env.NODE_PUBLIC_URL_BASE) return process.env.NODE_PUBLIC_URL_BASE.replace(/\/$/, "");
  return `${publicScheme()}://${publicHost()}`;
}

export function doorUrl(): string {
  return (process.env.NODEOS_DOOR_URL ?? process.env.NODEOS_DOOR ?? `http://127.0.0.1:${DOOR_PORT}`).replace(/\/$/, "");
}

export function doorPublic(): string {
  if (process.env.NODEOS_DOOR_PUBLIC) return process.env.NODEOS_DOOR_PUBLIC.replace(/\/$/, "");
  const host = tailnetHostname();
  if (host) return `https://${host}:${DOOR_PUBLIC_PORT}`;
  return `http://127.0.0.1:${DOOR_PORT}`;
}

export function nodePublic(): string {
  if (process.env.NODEOS_PUBLIC_ORIGIN) return process.env.NODEOS_PUBLIC_ORIGIN.replace(/\/$/, "");
  const host = tailnetHostname();
  if (host) return `https://${host}:${NODE_SERVE_PORT}`;
  return `http://127.0.0.1:${NODEOS_PORT}`;
}

export function frameHost(): string {
  return process.env.NODEOS_FRAME_HOST ?? (tailnetHostname() || "127.0.0.1");
}

export function publicDomain(): string {
  return process.env.NODE_PUBLIC_DOMAIN ?? "voicecommandapi.com";
}

export function frameAncestors(): string {
  if (process.env.NODEOS_FRAME_ANCESTORS) return process.env.NODEOS_FRAME_ANCESTORS.trim();
  const origin = nodePublic();
  const door = doorPublic();
  const host = tailnetHostname();
  const domain = publicDomain();
  const extras = [
    `http://127.0.0.1:${NODEOS_PORT}`,
    `http://localhost:${NODEOS_PORT}`,
    `http://${NODE_HOST}:${NODEOS_PORT}`,
    origin,
    door,
    host ? `https://${host}` : "",
    domain ? `https://node.${domain}` : "",
  ];
  return [...new Set(extras.filter(Boolean))].join(" ");
}

export function builtinVars(): Record<string, string> {
  const ip = tailscaleIp() || "127.0.0.1";
  const host = tailnetHostname() || "127.0.0.1";
  return {
    HOME,
    NODE_DATA,
    NODEOS_DATA_DIR: NODE_DATA,
    NODE_HOST,
    NODEOS_HOST: NODE_HOST,
    NODEOS_PORT: String(NODEOS_PORT),
    DOOR_PORT: String(DOOR_PORT),
    HUB_PORT: String(HUB_PORT),
    TAILNET_HOSTNAME: host,
    NODEOS_TAILNET_HOSTNAME: host,
    TAILSCALE_IP: ip,
    NODEOS_TAILSCALE_IP: ip,
    NODE_PUBLIC_SCHEME: publicScheme(),
    NODE_PUBLIC_HOST: publicHost(),
    NODE_PUBLIC_DOMAIN: publicDomain(),
    PUBLIC_URL_BASE: publicUrlBase(),
    NODEOS_DOOR_PUBLIC: doorPublic(),
    NODEOS_PUBLIC_ORIGIN: nodePublic(),
    NODEOS_FRAME_HOST: frameHost(),
  };
}

/** Expand ${VAR} and ${VAR:-default} using process.env, then built-in NODE vars. */
export function expandVars(s: string, extra: Record<string, string> = {}): string {
  const vars = { ...builtinVars(), ...extra };
  return s.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (all, name: string, def?: string) => {
    const env = process.env[name];
    if (env !== undefined && env !== "") return env;
    if (vars[name] !== undefined && vars[name] !== "") return vars[name];
    if (def !== undefined) return def;
    return all;
  }).replace(/\$HOME\b/g, vars.HOME);
}

export function expandJsonText(text: string): string {
  return expandVars(text);
}

export function resolveConfigFile(filename: string, envName: string | undefined, fromFile: string): string {
  if (envName && process.env[envName]) return process.env[envName]!;
  const dirs = [
    process.env.NODEOS_CONFIG_DIR,
    process.env.NODE_KIT_ROOT && path.join(process.env.NODE_KIT_ROOT, "config"),
    process.env.NODE_KIT_ROOT && path.join(process.env.NODE_KIT_ROOT, "src/boxes/config"),
    path.join(process.env.XDG_CONFIG_HOME ?? path.join(HOME, ".config"), "nodeos"),
  ];
  for (const dir of dirs) {
    if (dir && existsSync(path.join(dir, filename))) return path.join(dir, filename);
  }
  let dir = path.dirname(fromFile);
  for (let i = 0; i < 8; i++) {
    for (const cand of [path.join(dir, "config", filename), path.join(dir, filename)]) {
      if (existsSync(cand)) return cand;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(path.dirname(fromFile), "../../config", filename);
}

export function runtimeInfo(): {
  openAccess: boolean;
  mcpPublic: string;
  doorPublic: string;
  publicOrigin: string;
  host: string;
  port: number;
  frameHost: string;
} {
  return {
    openAccess: process.env.NODEOS_DEV_OPEN === "1",
    mcpPublic: `${doorPublic()}/mcp`,
    doorPublic: doorPublic(),
    publicOrigin: nodePublic(),
    host: NODE_HOST,
    port: NODEOS_PORT,
    frameHost: frameHost(),
  };
}

/** Used only so compiled output has a stable URL for path walks. */
export function thisFile(): string {
  return fileURLToPath(import.meta.url);
}
