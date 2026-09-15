import { PlugZap, Download, FlaskConical } from "lucide-react";
import { api } from "../api/client";
import type { FeatureStatus, Job } from "../api/types";
import { useToast } from "../state/toast";

/**
 * Shown wherever a panel has nothing real to display. NODE says which tool is
 * missing and offers to install it, rather than filling the screen with
 * numbers it made up.
 */
export function Unavailable({ status, onJob }: { status: FeatureStatus; onJob?: (id: string) => void }) {
  const toast = useToast();
  if (status.available) return null;
  const install = () => {
    if (!status.install) return;
    void api
      .post<Job>("/api/store/install", { name: status.install })
      .then((j) => onJob?.(j.id))
      .catch((e) => toast(e instanceof Error ? e.message : "Could not start the install", "error"));
  };
  return (
    <div className="empty" style={{ textAlign: "left", display: "flex", gap: 14, alignItems: "flex-start" }}>
      <PlugZap size={22} style={{ color: "var(--orange)", flex: "none", marginTop: 2 }} />
      <div className="stack grow" style={{ gap: 8 }}>
        <span style={{ fontWeight: 600, color: "var(--text-2)" }}>Not available on this machine</span>
        <span className="small">{status.reason}</span>
        {status.install && (
          <button type="button" className="btn sm primary" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={install}>
            <Download size={13} /> Install {status.install}
          </button>
        )}
      </div>
    </div>
  );
}

/** A small honest label wherever canned preview data is on screen. */
export function DemoBadge({ what = "Sample data" }: { what?: string }) {
  return (
    <span className="pill orange" title="Demo mode: this is placeholder data, not your machine">
      <FlaskConical size={11} /> {what}
    </span>
  );
}
