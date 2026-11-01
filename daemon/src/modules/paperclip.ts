import { createJob, appendLine, finishJob } from "./jobs.js";
import type { Job } from "../types.js";

/**
 * Paperclip is where work happens; NODE is only a front door. A request
 * becomes an issue assigned to Lead, and Lead's answer comment comes back
 * here. Same logic as ~/.local/bin/paperclip-mcp-slim paperclipAsk.
 */
const API = (process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100/api").replace(/\/$/, "");
const COMPANY = process.env.PAPERCLIP_COMPANY_ID ?? "ffaab782-ce21-4946-b86c-dbab054ddf1c";
const LEAD = process.env.PAPERCLIP_LEAD_ID ?? "19db7bc5-ff7f-4b5c-b2c2-a1f2ad35085b";
const TIMEOUT_MS = Number(process.env.PAPERCLIP_ASK_TIMEOUT ?? 600) * 1000;
const FINAL = new Set(["done", "cancelled", "blocked", "in_review"]);

async function pc<T>(method: string, p: string, body?: unknown): Promise<T> {
  const r = await fetch(API + p, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Paperclip ${r.status}: ${t.slice(0, 200)}`);
  return (t ? JSON.parse(t) : {}) as T;
}

interface Issue { id: string; identifier?: string; status?: string }
interface Comment { body?: string; authorType?: string; createdAt?: string }

export function askPaperclip(prompt: string, source = "NODE app", meta: Record<string, unknown> = {}): Job {
  const title = (prompt.split("\n")[0] || "Request from NODE").slice(0, 90);
  const job = createJob("agent", title, { ...meta, via: "paperclip", assignee: "Lead" });
  void (async () => {
    let iss: Issue;
    try {
      iss = await pc<Issue>("POST", `/companies/${COMPANY}/issues`, {
        title,
        description: `${prompt}\n\n---\nFrom Matt via ${source}. Answer or do this, then post the final answer for Matt as a short plain-language comment on this issue and set the issue to done. Delegate if needed.`,
        status: "todo",
        assigneeAgentId: LEAD,
      });
    } catch (e) {
      appendLine(job, `Could not reach Paperclip: ${(e as Error).message}`);
      return finishJob(job, false);
    }
    const ident = iss.identifier ?? iss.id;
    if (job.meta) { job.meta.issueId = iss.id; job.meta.issue = ident; }
    appendLine(job, `Working in Paperclip… issue ${ident} (assigned to Lead)`);
    const t0 = Date.now();
    let last: string | null = null;
    while (Date.now() - t0 < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const st = (await pc<Issue>("GET", `/issues/${iss.id}`)).status ?? "";
        const cs = (await pc<Comment[]>("GET", `/issues/${iss.id}/comments`))
          .filter((c) => c.authorType === "agent" && !String(c.body ?? "").startsWith("Warning:"))
          .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
        if (cs.length) last = cs[cs.length - 1].body ?? null;
        if (FINAL.has(st)) {
          appendLine(job, `${ident} — ${st}, ${Math.round((Date.now() - t0) / 1000)}s`);
          for (const l of (last ?? "(Lead set the issue to " + st + " without an answer comment)").split("\n")) appendLine(job, l);
          return finishJob(job, st === "done" || st === "in_review");
        }
      } catch { /* keep polling */ }
    }
    appendLine(job, `${ident} is still being worked on after ${TIMEOUT_MS / 1000}s. The answer will appear on that issue in Paperclip.`);
    if (last) for (const l of last.split("\n")) appendLine(job, l);
    finishJob(job, false);
  })();
  return job;
}

export interface AskResult { ok: boolean; issue: string; issueId: string; status: string; seconds: number; answer: string }

/** paperclipAsk, waiting for the answer (same logic as paperclip-mcp-slim). */
export async function askPaperclipWait(prompt: string, source: string, title?: string): Promise<AskResult> {
  const t = (title?.trim() || prompt.split("\n")[0] || "Request").slice(0, 90);
  const iss = await pc<Issue>("POST", `/companies/${COMPANY}/issues`, {
    title: t,
    description: `${prompt}\n\n---\nFrom Matt via ${source}. Answer or do this, then post the final answer for Matt as a short plain-language comment on this issue and set the issue to done. Delegate if needed.`,
    status: "todo",
    assigneeAgentId: LEAD,
  });
  const ident = iss.identifier ?? iss.id;
  const t0 = Date.now();
  let last: string | null = null;
  while (Date.now() - t0 < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const st = (await pc<Issue>("GET", `/issues/${iss.id}`)).status ?? "";
      const cs = (await pc<Comment[]>("GET", `/issues/${iss.id}/comments`))
        .filter((c) => c.authorType === "agent" && !String(c.body ?? "").startsWith("Warning:"))
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      if (cs.length) last = cs[cs.length - 1].body ?? null;
      if (FINAL.has(st)) return { ok: st === "done" || st === "in_review", issue: ident, issueId: iss.id, status: st, seconds: Math.round((Date.now() - t0) / 1000), answer: last ?? "(no answer comment)" };
    } catch { /* keep polling */ }
  }
  return { ok: false, issue: ident, issueId: iss.id, status: "still_working", seconds: Math.round((Date.now() - t0) / 1000), answer: (last ?? "no answer yet") + " — the answer will appear on that issue in Paperclip." };
}
