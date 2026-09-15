import { spawn } from "node:child_process";
import { has, run } from "../exec.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The box's voice.
 *
 * The phone carries the number and the accounts. The box does the talking —
 * one voice for the TV, for a phone call, and for a text read aloud, so the
 * business sounds like one thing no matter which door somebody came in.
 *
 * A BINARY ON DISK, NOT A SERVICE. Piper is 60MB and a voice file. It takes a
 * sentence on stdin and hands back a WAV. There is no server, no port, no
 * request, and nothing to be down. Any other engine that works the same way
 * goes in NODEOS_TTS_CMD and is used ahead of Piper.
 *
 * An HTTP endpoint is supported and is last. It is there for the bench, where
 * an engine happens to ship as a container, and for a cloud voice somebody
 * pays for later. Nothing ships pointed at one.
 */

export type Engine = "command" | "piper" | "espeak" | "http" | "none";

export interface Speech {
  /** 16-bit PCM WAV. Callers stream it or hand it to a player. */
  wav: Buffer;
  engine: Engine;
  sampleRate: number;
}

const VOICE = process.env.NODEOS_TTS_VOICE ?? "/usr/share/piper-voices/en_US-amy-medium.onnx";

/**
 * Your own engine. A command line; the sentence arrives on stdin and the WAV
 * is expected at the path substituted for {out}. Split on whitespace and run
 * directly — no shell, so nothing in a caller's sentence can reach one.
 *
 *   NODEOS_TTS_CMD="kokoro-onnx --voice af_sky --out {out}"
 */
const CMD = (process.env.NODEOS_TTS_CMD ?? "").trim();
const CMD_RATE = Number(process.env.NODEOS_TTS_CMD_RATE ?? 24_000);

/** An OpenAI-shaped speech endpoint. Unset on a shipped box. */
const TTS_URL = process.env.NODEOS_TTS_URL ?? "";
const TTS_VOICE = process.env.NODEOS_TTS_REMOTE_VOICE ?? "af_sky";
const TTS_MODEL = process.env.NODEOS_TTS_MODEL ?? "kokoro";
const TTS_TIMEOUT_MS = 30_000;

let cached: Engine[] | null = null;

/** Every engine this machine has, best first. Checked once. */
async function engines(): Promise<Engine[]> {
  if (cached) return cached;
  const found: Engine[] = [];
  if (CMD) found.push("command");
  if (await has("piper")) found.push("piper");
  if (await has("espeak-ng")) found.push("espeak");
  if (TTS_URL) found.push("http");
  cached = found;
  return found;
}

/** What it will use if asked right now. */
export async function engine(): Promise<Engine> {
  return (await engines())[0] ?? "none";
}

async function viaCommand(clean: string): Promise<Speech | null> {
  const parts = CMD.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "nodeos-tts-"));
  const out = path.join(dir, "out.wav");
  try {
    const r = await run(
      parts[0]!,
      parts.slice(1).map((a) => a.replace("{out}", out)),
      { timeout: 30_000, input: clean },
    );
    if (!r.ok) return null;
    return { wav: await readFile(out), engine: "command", sampleRate: CMD_RATE };
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function viaPiper(clean: string): Promise<Speech | null> {
  // Piper reads the sentence on stdin and writes a WAV on stdout.
  return new Promise((resolve) => {
    const p = spawn("piper", ["--model", VOICE, "--output_file", "-"], { stdio: ["pipe", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    p.stdout.on("data", (c: Buffer) => chunks.push(c));
    p.on("close", (code) =>
      resolve(code === 0 && chunks.length ? { wav: Buffer.concat(chunks), engine: "piper", sampleRate: 22_050 } : null),
    );
    p.on("error", () => resolve(null));
    p.stdin.end(clean);
  });
}

async function viaEspeak(clean: string): Promise<Speech | null> {
  const dir = await mkdtemp(path.join(tmpdir(), "nodeos-tts-"));
  const out = path.join(dir, "out.wav");
  try {
    const r = await run("espeak-ng", ["-w", out, "-s", "165", clean], { timeout: 20_000 });
    if (!r.ok) return null;
    return { wav: await readFile(out), engine: "espeak", sampleRate: 22_050 };
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function viaHttp(clean: string): Promise<Speech | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TTS_TIMEOUT_MS);
  try {
    const res = await fetch(`${TTS_URL.replace(/\/$/, "")}/audio/speech`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: TTS_MODEL, voice: TTS_VOICE, input: clean, response_format: "wav" }),
    });
    if (!res.ok) return null;
    const wav = Buffer.from(await res.arrayBuffer());
    return wav.length < 64 ? null : { wav, engine: "http", sampleRate: 24_000 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function render(e: Engine, clean: string): Promise<Speech | null> {
  if (e === "command") return viaCommand(clean);
  if (e === "piper") return viaPiper(clean);
  if (e === "espeak") return viaEspeak(clean);
  if (e === "http") return viaHttp(clean);
  return null;
}

export async function speak(text: string): Promise<Speech | null> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!clean) return null;

  // A missing voice file, a model that will not load, a container that is
  // restarting — none of them are allowed to take the voice with them. Try the
  // next one down until something talks.
  for (const e of await engines()) {
    const s = await render(e, clean);
    if (s) return s;
  }
  return null;
}

/** Say it out loud on this machine's own speakers. */
export async function sayAloud(text: string): Promise<boolean> {
  const s = await speak(text);
  if (!s) return false;
  const player = (await has("paplay")) ? "paplay" : (await has("aplay")) ? "aplay" : null;
  if (!player) return false;
  return new Promise((resolve) => {
    const p = spawn(player, player === "aplay" ? ["-q", "-"] : ["-"], { stdio: ["pipe", "ignore", "ignore"] });
    p.on("close", (c) => resolve(c === 0));
    p.on("error", () => resolve(false));
    p.stdin.end(s.wav);
  });
}
