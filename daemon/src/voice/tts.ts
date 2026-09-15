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
 * with no GPU and no network. A cloud voice is faster and better and is a
 * setting, not the design.
 */

export type Engine = "piper" | "espeak" | "none";

export interface Speech {
  /** 16-bit PCM WAV. Callers stream it or hand it to a player. */
  wav: Buffer;
  engine: Engine;
  sampleRate: number;
}

const VOICE = process.env.NODEOS_TTS_VOICE ?? "/usr/share/piper-voices/en_US-amy-medium.onnx";

let cached: Engine | null = null;

/** Which voice this machine actually has. Checked once. */
export async function engine(): Promise<Engine> {
  if (cached) return cached;
  if (await has("piper")) cached = "piper";
  else if (await has("espeak-ng")) cached = "espeak";
  else cached = "none";
  return cached;
}

export async function speak(text: string): Promise<Speech | null> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!clean) return null;

  const e = await engine();
  if (e === "none") return null;

  if (e === "espeak") {
    const dir = await mkdtemp(path.join(tmpdir(), "nodeos-tts-"));
    const out = path.join(dir, "out.wav");
    try {
      await run("espeak-ng", ["-w", out, "-s", "165", clean], { timeout: 20_000 });
      return { wav: await readFile(out), engine: "espeak", sampleRate: 22_050 };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

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
