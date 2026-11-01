import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * The one model gateway: LiteLLM (:4000). Every model call in node-box goes
 * through here. The key is read from LiteLLM's env file at call time and is
 * never logged or returned.
 */
export const GATEWAY = (process.env.NODEOS_LLM_URL ?? "http://127.0.0.1:4000/v1").replace(/\/$/, "");
const ENV_FILE = process.env.NODEOS_LITELLM_ENV ?? path.join(os.homedir(), ".config/litellm/litellm.env");

export async function gatewayKey(): Promise<string> {
  try {
    const m = (await readFile(ENV_FILE, "utf8")).match(/^LITELLM_MASTER_KEY=["']?([^"'\n]+)/m);
    return m?.[1] ?? "";
  } catch {
    return "";
  }
}

export async function gatewayHeaders(json = true): Promise<Record<string, string>> {
  const k = await gatewayKey();
  return { ...(json ? { "Content-Type": "application/json" } : {}), ...(k ? { Authorization: `Bearer ${k}` } : {}) };
}
