import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./paths.js";

/**
 * Tiny JSON document store: one file per collection under ~/.local/share/nodeos.
 * Writes are atomic (temp file + rename) so a crash never leaves half a file.
 */
export class JsonStore<T> {
  private file: string;
  private cache: T | null = null;
  private writing: Promise<void> = Promise.resolve();

  constructor(name: string, private initial: () => T) {
    this.file = path.join(DATA_DIR, `${name}.json`);
  }

  async read(): Promise<T> {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(await readFile(this.file, "utf8")) as T;
    } catch {
      this.cache = this.initial();
    }
    return this.cache;
  }

  async write(value: T): Promise<void> {
    this.cache = value;
    const tmp = `${this.file}.${process.pid}.tmp`;
    this.writing = this.writing.then(async () => {
      try {
        await writeFile(tmp, JSON.stringify(value, null, 2));
        await rename(tmp, this.file);
      } catch {
        /* memory-only fallback */
      }
    });
    await this.writing;
  }

  async update(fn: (current: T) => T): Promise<T> {
    const next = fn(await this.read());
    await this.write(next);
    return next;
  }
}

export function id(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
