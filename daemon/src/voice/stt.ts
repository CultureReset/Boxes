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

export type Model = "whisper-cpp" | "faster-whisper" | "none";

let cached: Model | null = null;

export async function model(): Promise<Model> {
  if (cached) return cached;
  if (await has("whisper-cli")) cached = "whisper-cpp";
  else if (await has("whisper-cpp")) cached = "whisper-cpp";
  else if (await has("faster-whisper")) cached = "faster-whisper";
  else cached = "none";
  return cached;
}

const MODEL_PATH = process.env.NODEOS_STT_MODEL ?? "/usr/share/whisper/ggml-small.en.bin";

/** Transcribe 16kHz mono WAV. Returns "" when nothing could be heard. */
export async function transcribe(wav: Buffer): Promise<string> {
  const m = await model();
  if (m === "none") return "";

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
