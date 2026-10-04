import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { CONFIG_DIR } from "../paths.js";

/**
 * What pairing gave this computer. One file, mode 0600, never shown on screen.
 *
 *   nodeToken  gcr-api-clean's token for this computer (ghost_nodes), collected
 *              once from POST /api/nodes/pair/poll after the owner confirmed the
 *              code. It is the computer's relay identity, not a database key.
 *   account    how this screen reaches the owner's Paperclip account (and
 *              through it a business token for gcr-api-clean). NOT DECIDED YET:
 *              the plan says the computer gets "its own token tied to that
 *              business" but not how a screen signs in to Paperclip. Nothing in
 *              Boxes writes this field; until the decision is made, every cloud
 *              screen says the account link is missing. See the README.
 */
export interface Creds {
  nodeToken?: string;
  node?: { id: string; name: string | null };
  pairedAt?: string;
  account?: { key: string; companyId: string; companyName?: string };
}

const FILE = path.join(CONFIG_DIR, "nextgent.json");
let cached: Creds | null = null;

export async function readCreds(): Promise<Creds> {
  if (cached) return cached;
  try {
    cached = JSON.parse(await readFile(FILE, "utf8")) as Creds;
  } catch {
    cached = {};
  }
  return cached;
}

export async function saveCreds(patch: Partial<Creds>): Promise<Creds> {
  const next = { ...(await readCreds()), ...patch };
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
  cached = next;
  return next;
}

export async function clearCreds(): Promise<void> {
  cached = {};
  await rm(FILE, { force: true });
}

/** Paired: the business confirmed this computer and it holds its node token. */
export const paired = (c: Creds) => Boolean(c.nodeToken);
/** The screen can also reach the account (see `account` above). */
export const accountLinked = (c: Creds) => Boolean(c.account?.key && c.account.companyId);
