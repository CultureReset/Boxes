import { id } from "../store.js";
import { bus } from "../events.js";
import type { Job } from "../types.js";

/** In-memory registry of long-running work (installs, agent runs). Output streams over SSE. */
const jobs = new Map<string, Job>();
const MAX_LINES = 400;

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
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function listJobs(): Job[] {
  return [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
