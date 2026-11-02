import { readFileSync } from "node:fs";
import { HOME_DEFAULTS } from "./homeDefaults.js";

/**
 * How this NODE is being run.
 *
 *   home      (default) the platform owner's own computer. Hardware modules are
 *             live and the owner's defaults apply, exactly as before.
 *   customer  a hosted copy for one customer business, in a container on the
 *             platform owner's machine. No phone, no window streaming, no power
 *             or systemctl control, no host paths, and nothing of the platform
 *             owner's is assumed: every such value must be supplied.
 *
 * NODEOS_HARDWARE=0 switches only the hardware modules off, without the rest of
 * customer mode.
 */
type Env = Record<string, string | undefined>;

export type NodeMode = "home" | "customer";

export const HOSTED_MESSAGE = "Not available in hosted mode";

export function nodeMode(env: Env = process.env): NodeMode {
  const v = (env.NODEOS_MODE ?? "").trim().toLowerCase();
  if (v === "" || v === "home") return "home";
  if (v === "customer") return "customer";
  // A typo must not silently fall back to home mode, which carries the owner's defaults.
  throw new Error(`NODEOS_MODE must be "home" or "customer"`);
}

export const isCustomerMode = (env: Env = process.env): boolean => nodeMode(env) === "customer";

/** True when adb, window streaming, power, systemctl and host-path reads must stay inert. */
export function hostedMode(env: Env = process.env): boolean {
  return isCustomerMode(env) || (env.NODEOS_HARDWARE ?? "").trim() === "0";
}

/** What status reports for features that do not exist in hosted mode. */
export const HOSTED_UNAVAILABLE = ["phone", "window streaming", "power", "services", "frame proxies", "host files", "software store"] as const;

export function hostedInfo(env: Env = process.env): { mode: NodeMode; message: string; unavailable: readonly string[] } | null {
  if (!hostedMode(env)) return null;
  return { mode: nodeMode(env), message: HOSTED_MESSAGE, unavailable: HOSTED_UNAVAILABLE };
}

/** One line of untrusted-ish text that ends up inside an issue an agent reads. */
function oneLine(v: string, max = 80): string {
  return v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function ownerName(env: Env = process.env): string {
  const v = oneLine(env.NODEOS_OWNER_NAME ?? "");
  if (v) return v;
  return isCustomerMode(env) ? "" : HOME_DEFAULTS.ownerName;
}

export function businessName(env: Env = process.env): string {
  return oneLine(env.NODEOS_BUSINESS_NAME ?? "", 120);
}

/** Door and public-origin defaults: the owner's tailnet in home mode, nothing in customer mode. */
export function doorPublic(env: Env = process.env): string {
  return (env.NODEOS_DOOR_PUBLIC ?? (isCustomerMode(env) ? "" : HOME_DEFAULTS.doorPublic)).replace(/\/$/, "");
}
export function nodePublic(env: Env = process.env): string {
  return env.NODEOS_PUBLIC_ORIGIN ?? (isCustomerMode(env) ? "" : HOME_DEFAULTS.nodePublic);
}

/** Where uploads go. Home keeps the owner's disk; hosted mode never touches a host path. */
export function uploadDirDefault(dataDir: string, env: Env = process.env): string {
  if (env.NODEOS_UPLOAD_DIR) return env.NODEOS_UPLOAD_DIR;
  return hostedMode(env) ? `${dataDir}/uploads` : HOME_DEFAULTS.uploadDir;
}

/** Secret from NAME, or from the file named by NAME_FILE. Never logged. */
export function secret(name: string, env: Env = process.env): string | undefined {
  const direct = env[name];
  if (direct) return direct;
  const file = env[`${name}_FILE`];
  if (!file) return undefined;
  try {
    return readFileSync(file, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

// ---- Paperclip -----------------------------------------------------------

export interface PaperclipSettings {
  api: string;
  company: string;
  lead: string;
  owner: string;
  business: string;
}

export function paperclipSettings(env: Env = process.env): PaperclipSettings {
  const customer = isCustomerMode(env);
  return {
    api: (env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100/api").replace(/\/$/, ""),
    company: env.PAPERCLIP_COMPANY_ID ?? (customer ? "" : HOME_DEFAULTS.paperclipCompany),
    lead: env.PAPERCLIP_LEAD_ID ?? (customer ? "" : HOME_DEFAULTS.paperclipLead),
    owner: ownerName(env),
    business: businessName(env),
  };
}

/**
 * The text Lead reads. Home mode is byte-for-byte what it always was; customer
 * mode names the customer's owner and business instead.
 */
export function issueDescription(prompt: string, source: string, s: PaperclipSettings): string {
  const from = s.business ? `${s.owner} (${s.business})` : s.owner;
  return `${prompt}\n\n---\nFrom ${from} via ${source}. Answer or do this, then post the final answer for ${s.owner} as a short plain-language comment on this issue and set the issue to done. Delegate if needed.`;
}

// ---- Startup validation --------------------------------------------------

export const CUSTOMER_REQUIRED = [
  "NODEOS_OWNER_NAME",
  "NODEOS_BUSINESS_NAME",
  "NODEOS_SLUG",
  "PAPERCLIP_API_URL",
  "PAPERCLIP_COMPANY_ID",
  "PAPERCLIP_LEAD_ID",
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Problems with the environment for customer mode, by variable name. Never includes a value. */
export function customerEnvProblems(env: Env = process.env): string[] {
  const problems: string[] = [];
  for (const name of CUSTOMER_REQUIRED) if (!(env[name] ?? "").trim()) problems.push(`${name} is required in customer mode`);
  for (const name of ["PAPERCLIP_COMPANY_ID", "PAPERCLIP_LEAD_ID"] as const) {
    const v = (env[name] ?? "").trim();
    if (v && !UUID.test(v)) problems.push(`${name} must be a UUID`);
  }
  const api = (env.PAPERCLIP_API_URL ?? "").trim();
  if (api && !/^https?:\/\/[^\s/]+/i.test(api)) problems.push("PAPERCLIP_API_URL must be an http(s) URL");
  // A customer pointed at the platform owner's own company would read and write the owner's work.
  const own = [HOME_DEFAULTS.paperclipCompany, HOME_DEFAULTS.paperclipLead].filter(Boolean).map((x) => x.toLowerCase());
  for (const name of ["PAPERCLIP_COMPANY_ID", "PAPERCLIP_LEAD_ID"] as const) {
    if (own.includes((env[name] ?? "").trim().toLowerCase())) problems.push(`${name} is the platform owner's own id; each customer needs their own`);
  }
  return problems;
}

export class CustomerConfigError extends Error {
  constructor(public problems: string[]) {
    super(`Customer mode cannot start:\n  - ${problems.join("\n  - ")}`);
  }
}

/** Throws CustomerConfigError in customer mode when anything required is missing. No-op in home mode. */
export function assertCustomerEnv(env: Env = process.env): void {
  if (!isCustomerMode(env)) return;
  const problems = customerEnvProblems(env);
  if (problems.length) throw new CustomerConfigError(problems);
}
