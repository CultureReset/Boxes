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
 * Local first. Piper is a 60MB binary and a voice file; it runs on a mini-PC
 * with no GPU and no network. Kokoro is better and wants a GPU, so it is a
 * setting: point NODEOS_TTS_URL at it and it is used, leave it unset and the
 * box still talks. Either way nothing leaves the machine.
 */

export type Engine = "kokoro" | "piper" | "espeak" | "none";

export interface Speech {
  /** 16-bit PCM WAV. Callers stream it or hand it to a player. */
  wav: Buffer;
  engine: Engine;
  sampleRate: number;
}

const VOICE = process.env.NODEOS_TTS_VOICE ?? "/usr/share/piper-voices/en_US-amy-medium.onnx";

/**
 * An OpenAI-compatible speech endpoint — Kokoro-FastAPI is the one this was
 * written against. Unset means local binaries only; the box never reaches for
 * a service nobody asked for.
 */
const TTS_URL = process.env.NODEOS_TTS_URL ?? "";
const TTS_VOICE = process.env.NODEOS_TTS_REMOTE_VOICE ?? "af_sky";
const TTS_MODEL = process.env.NODEOS_TTS_MODEL ?? "kokoro";
const TTS_TIMEOUT_MS = 30_000;

let cached: Engine | null = null;

/** Which voice this machine actually has. Checked once. */
export async function engine(): Promise<Engine> {
  if (cached) return cached;
  if (TTS_URL) cached = "kokoro";
  else if (await has("piper")) cached = "piper";
  else if (await has("espeak-ng")) cached = "espeak";
  else cached = "none";
  return cached;
}

/** A local engine, for when the configured remote one is not answering. */
async function localEngine(): Promise<Engine> {
  if (await has("piper")) return "piper";
  if (await has("espeak-ng")) return "espeak";
  return "none";
}

async function kokoro(clean: string): Promise<Speech | null> {
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
    if (wav.length < 64) return null;
    return { wav, engine: "kokoro", sampleRate: 24_000 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function piper(clean: string): Promise<Speech | null> {
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

async function espeak(clean: string): Promise<Speech | null> {
  const dir = await mkdtemp(path.join(tmpdir(), "nodeos-tts-"));
  const out = path.join(dir, "out.wav");
  try {
    await run("espeak-ng", ["-w", out, "-s", "165", clean], { timeout: 20_000 });
    return { wav: await readFile(out), engine: "espeak", sampleRate: 22_050 };
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function render(e: Engine, clean: string): Promise<Speech | null> {
  if (e === "kokoro") return kokoro(clean);
  if (e === "piper") return piper(clean);
  if (e === "espeak") return espeak(clean);
  return null;
}

export async function speak(text: string): Promise<Speech | null> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!clean) return null;

  const e = await engine();
  const first = await render(e, clean);
  if (first) return first;

  // A container that is down, restarting or out of VRAM must not take the
  // voice with it. Fall back to whatever is on disk and keep talking.
  if (e === "kokoro") {
    const l = await localEngine();
    if (l !== "none") return render(l, clean);
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
