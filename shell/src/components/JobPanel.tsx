import { useEffect, useRef, useState } from "react";
import { Sparkles, Package, CheckCircle2, XCircle } from "lucide-react";
import { api, useEvent } from "../api/client";
import type { Job } from "../api/types";
import { Sheet } from "./Sheet";

/** Live output of a background job: an agent answer, an install, an update. */
export function JobPanel({ jobId, onClose, title }: { jobId: string; onClose: () => void; title?: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.get<Job>(`/api/jobs/${jobId}`).then(setJob).catch(() => {});
  }, [jobId]);
  useEvent<Job>("job", (j) => j.id === jobId && setJob(j));
  useEvent<{ id: string; line: string }>("job-line", (d) => d.id === jobId && setJob((j) => (j ? { ...j, lines: [...j.lines, d.line] } : j)));
  useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [job?.lines.length]);

  const isAgent = job?.kind === "agent";
  const text = job?.lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") ?? "";
  return (
    <Sheet title={title ?? job?.title ?? "Working…"} icon={isAgent ? <Sparkles size={18} /> : <Package size={18} />} onClose={onClose} size="wide">
      <div className="row" style={{ marginBottom: 12 }}>
        {job?.status === "running" && <span className="spinner" />}
        {job?.status === "done" && <CheckCircle2 size={16} color="var(--green)" />}
        {job?.status === "failed" && <XCircle size={16} color="var(--red)" />}
        <span className="dim small">{job?.status === "running" ? (isAgent ? "Thinking…" : "Working…") : job?.status === "done" ? "Done" : job?.status === "failed" ? "Something went wrong" : ""}</span>
      </div>
      <div ref={outRef} className={`job-out${isAgent ? " plain" : " mono"}`}>
        {text || (job?.status === "running" ? " " : "No output.")}
      </div>
    </Sheet>
  );
}
