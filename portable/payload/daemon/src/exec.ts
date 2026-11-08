import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { access, constants } from "node:fs/promises";
import path from "node:path";

const execFileP = promisify(execFile);

export interface RunResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

const whichCache = new Map<string, boolean>();

/** True when `cmd` is on PATH. Cached for the daemon lifetime. */
export async function has(cmd: string): Promise<boolean> {
  const cached = whichCache.get(cmd);
  if (cached !== undefined) return cached;
  const dirs = (process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin").split(":");
  let found = false;
  for (const dir of dirs) {
    try {
      await access(path.join(dir, cmd), constants.X_OK);
      found = true;
      break;
    } catch {
      /* keep looking */
    }
  }
  whichCache.set(cmd, found);
  return found;
}

/**
 * Run a command with an argument array (never through a shell) and a timeout.
 * Never throws: a missing binary or non-zero exit comes back as ok=false.
 */
export async function run(cmd: string, args: string[] = [], opts: { timeout?: number; input?: string; env?: NodeJS.ProcessEnv } = {}): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileP(cmd, args, {
      timeout: opts.timeout ?? 8000,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, ...opts.env },
      encoding: "utf8",
    });
    return { ok: true, code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      code: typeof e.code === "number" ? e.code : null,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? String(err),
    };
  }
}

/** Run and parse JSON stdout; null when the command fails or output is not JSON. */
export async function runJson<T>(cmd: string, args: string[] = [], opts?: { timeout?: number }): Promise<T | null> {
  const r = await run(cmd, args, opts);
  if (!r.ok) return null;
  try {
    return JSON.parse(r.stdout) as T;
  } catch {
    return null;
  }
}

/**
 * Launch a long-lived desktop process detached from the daemon so that
 * closing the daemon never takes user apps down with it.
 */
export function launchDetached(cmd: string, args: string[] = [], cwd?: string): boolean {
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore", cwd, env: process.env });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Spawn a process and stream its output line by line. Used for package installs
 * and agent runs where progress matters.
 */
export function stream(
  cmd: string,
  args: string[],
  onLine: (line: string, channel: "stdout" | "stderr") => void,
  opts: { input?: string; cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<number | null> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd: opts.cwd, env: { ...process.env, ...opts.env }, stdio: ["pipe", "pipe", "pipe"] });
    } catch (err) {
      onLine(String(err), "stderr");
      resolve(null);
      return;
    }
    const buffers: Record<"stdout" | "stderr", string> = { stdout: "", stderr: "" };
    const pump = (channel: "stdout" | "stderr") => (chunk: Buffer) => {
      buffers[channel] += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffers[channel].indexOf("\n")) >= 0) {
        onLine(buffers[channel].slice(0, idx).replace(/\r$/, ""), channel);
        buffers[channel] = buffers[channel].slice(idx + 1);
      }
    };
    child.stdout.on("data", pump("stdout"));
    child.stderr.on("data", pump("stderr"));
    child.on("error", (err) => {
      onLine(err.message, "stderr");
      resolve(null);
    });
    child.on("close", (code) => {
      for (const ch of ["stdout", "stderr"] as const) if (buffers[ch]) onLine(buffers[ch], ch);
      resolve(code);
    });
    if (opts.input !== undefined) child.stdin.write(opts.input);
    child.stdin.end();
  });
}
