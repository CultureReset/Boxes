import { has, run } from "../exec.js";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Hearing.
 *
 * whisper.cpp with a small English model transcribes a short utterance on a
 * CPU in about a second. That is the budget: a sentence, not a meeting.
 *
 * Nothing here interprets. It returns the words that were said, and the router
 * above decides whether they mean anything.
 */

export type Model = "whisper-cpp" | "faster-whisper" | "llama-swap" | "none";

let cached: Model | null = null;

export async function model(): Promise<Model> {
  if (cached) return cached;
  if (await has("whisper-cli")) cached = "whisper-cpp";
  else if (await has("whisper-cpp")) cached = "whisper-cpp";
  else if (await has("faster-whisper")) cached = "faster-whisper";
  else if (await swapHasAsr()) cached = "llama-swap";
  else cached = "none";
  // Only remember a working answer; "none" is retried so a late llama-swap is found.
  const found = cached;
  if (found === "none") cached = null;
  return found;
}

/** llama-swap (:8080) serves Qwen3-ASR as model "asr" on /v1/audio/transcriptions. */
const SWAP = process.env.NODEOS_LLM_URL ?? "http://127.0.0.1:8080/v1";
const SWAP_ASR = process.env.NODEOS_STT_SWAP_MODEL ?? "asr";

async function swapHasAsr(): Promise<boolean> {
  try {
    const r = await fetch(`${SWAP}/models`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const j = (await r.json()) as { data?: { id: string }[] };
    return (j.data ?? []).some((m) => m.id === SWAP_ASR);
  } catch {
    return false;
  }
}

async function swapTranscribe(wav: Buffer): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "in.wav");
  form.append("model", SWAP_ASR);
  const r = await fetch(`${SWAP}/audio/transcriptions`, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) });
  if (!r.ok) return "";
  const j = (await r.json()) as { text?: string };
  // Qwen3-ASR prefixes its output with "language English<asr_text>".
  return (j.text ?? "").replace(/^.*<asr_text>/s, "").trim();
}

const MODEL_PATH = process.env.NODEOS_STT_MODEL ?? "/usr/share/whisper/ggml-small.en.bin";

/** Transcribe 16kHz mono WAV. Returns "" when nothing could be heard. */
export async function transcribe(wav: Buffer): Promise<string> {
  const m = await model();
  if (m === "none") return "";
  if (m === "llama-swap") return swapTranscribe(wav);

  const dir = await mkdtemp(path.join(tmpdir(), "nodeos-stt-"));
  const input = path.join(dir, "in.wav");
  try {
    await writeFile(input, wav);

    if (m === "faster-whisper") {
      const r = await run("faster-whisper", ["--model", "small.en", "--output_format", "txt", input], { timeout: 60_000 });
      return r.stdout.trim();
    }

    const bin = (await has("whisper-cli")) ? "whisper-cli" : "whisper-cpp";
    const r = await run(bin, ["-m", MODEL_PATH, "-f", input, "-nt", "-np", "--output-txt", "-of", path.join(dir, "out")], {
      timeout: 60_000,
    });
    // -nt strips timestamps, so stdout is the sentence.
    return r.stdout.replace(/\[[^\]]*\]/g, "").trim();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
