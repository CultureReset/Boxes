// The issue ids this container created, so it can read back its own issues and
// nobody else's. Kept on the container's state volume so a restart does not
// strand an answer that is still being worked on. Bounded: the oldest ids drop
// first, so the file cannot grow without limit.
import fs from "node:fs";
import path from "node:path";
import { ISSUE_ID } from "./policy.mjs";

export class IssueStore {
  /**
   * @param {{dir: string, companyId: string, max?: number, file?: string}} o
   * Throws if the directory cannot be created or written: a store that silently
   * keeps nothing would look like it works until the first restart.
   */
  constructor({ dir, companyId, max = 2000, file = "issues.json" }) {
    this.max = Math.max(1, Math.floor(max));
    this.companyId = companyId;
    this.file = path.join(dir, file);
    this.ids = new Set();
    this.loadedFromDisk = 0;
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.load();
    this.save(); // proves the directory is writable now, not at the first create
  }

  load() {
    let raw;
    try {
      raw = fs.readFileSync(this.file, "utf8");
    } catch (e) {
      if (e && e.code === "ENOENT") return;
      throw e;
    }
    try {
      const doc = JSON.parse(raw);
      // Ids recorded for another company are not ours to honour.
      if (doc && doc.v === 1 && doc.companyId === this.companyId && Array.isArray(doc.ids)) {
        for (const id of doc.ids) if (typeof id === "string" && ISSUE_ID.test(id)) this.ids.add(id);
        this.trim();
        this.loadedFromDisk = this.ids.size;
      }
    } catch {
      // A damaged file means "no ids known": the safe direction. It is overwritten by save().
    }
  }

  trim() {
    while (this.ids.size > this.max) this.ids.delete(this.ids.values().next().value);
  }

  has(id) {
    return this.ids.has(id);
  }

  get size() {
    return this.ids.size;
  }

  /** Record an id. Returns false (and records nothing) if it is not a plain id. */
  add(id) {
    if (typeof id !== "string" || !ISSUE_ID.test(id)) return false;
    this.ids.delete(id); // re-adding moves it to the newest end
    this.ids.add(id);
    this.trim();
    this.save();
    return true;
  }

  save() {
    const tmp = `${this.file}.${process.pid}.tmp`;
    const body = JSON.stringify({ v: 1, companyId: this.companyId, ids: [...this.ids] });
    fs.writeFileSync(tmp, body, { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }
}
