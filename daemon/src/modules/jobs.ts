import { id, JsonStore } from "../store.js";
import { bus } from "../events.js";
import type { Job } from "../types.js";

/**
 * Registry of long-running work (installs, agent runs). Output streams over SSE.
 * Finished jobs are kept on disk (jobs.json) so the history survives a restart.
 */
const jobs = new Map<string, Job>();
const MAX_LINES = 400;
const store = new JsonStore<Job[]>("jobs", () => []);

for (const j of await store.read()) {
  // Anything still "running" in the file was cut off by a restart.
  if (j.status === "running") {
    j.status = "failed";
    j.finishedAt ??= j.startedAt;
  }
  jobs.set(j.id, j);
}

function persist(): void {
  void store.write(listJobs().filter((j) => j.status !== "running").slice(0, 50));
}

export function createJob(kind: Job["kind"], title: string, meta?: Record<string, unknown>): Job {
  const job: Job = { id: id(), kind, title, status: "running", lines: [], startedAt: new Date().toISOString(), meta };
  jobs.set(job.id, job);
  // Keep memory bounded.
  if (jobs.size > 50) {
    const oldest = [...jobs.values()].filter((j) => j.status !== "running").sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
    if (oldest) jobs.delete(oldest.id);
  }
  bus.emit("job", job);
  return job;
}

export function appendLine(job: Job, line: string): void {
  job.lines.push(line);
  if (job.lines.length > MAX_LINES) job.lines.splice(0, job.lines.length - MAX_LINES);
  bus.emit("job-line", { id: job.id, line });
}

export function finishJob(job: Job, ok: boolean): void {
  job.status = ok ? "done" : "failed";
  job.finishedAt = new Date().toISOString();
  bus.emit("job", job);
  persist();
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function listJobs(): Job[] {
  return [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
