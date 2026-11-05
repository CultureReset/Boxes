import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Play, Shield, XCircle } from "lucide-react";
import { api, useApi } from "../api/client";
import { Hero } from "../components/Hero";
import { Section } from "../components/Section";
import { Empty, Pill, Skeleton } from "../components/ui";
import { useToast } from "../state/toast";
import { navigate } from "../lib/router";
import type { ScreenProps } from "../modules/registry";

/** M1d receipt ledger + approved workflow request → OTP → running → receipt UI. */

type ReceiptStatus = "requested" | "pending" | "approved" | "running" | "completed" | "failed" | "denied";

interface WorkflowReceipt {
  id: string;
  workflowId: string;
  workflowName: string;
  actionType: string;
  approvalId?: string;
  status: ReceiptStatus;
  requestedAt: string;
  updatedAt: string;
  completedAt?: string;
  otpRequired: boolean;
  otpSubmitted: boolean;
  proof?: string;
  error?: string;
}

interface WorkflowCatalog {
  canned: Array<{ id: string; name: string; actionType: string; description: string }>;
  note: string;
}

const STEPS: ReceiptStatus[] = ["pending", "approved", "running", "completed"];

function statusColor(s: ReceiptStatus): "green" | "orange" | "blue" | "red" | "purple" {
  if (s === "completed") return "green";
  if (s === "failed" || s === "denied") return "red";
  if (s === "running" || s === "approved") return "blue";
  if (s === "pending" || s === "requested") return "orange";
  return "purple";
}

function Stepper({ status }: { status: ReceiptStatus }) {
  const idx = status === "failed" || status === "denied" ? -1 : STEPS.indexOf(status === "requested" ? "pending" : status);
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 12px" }}>
      {STEPS.map((s, i) => (
        <Pill key={s} color={idx >= i ? "blue" : undefined} dot={idx === i}>
          {s}
        </Pill>
      ))}
      {(status === "failed" || status === "denied") && <Pill color="red" dot>{status}</Pill>}
    </div>
  );
}

export function Receipts({ params }: ScreenProps) {
  const toast = useToast();
  const focus = params.get("id");
  const { data: catalog } = useApi<WorkflowCatalog>("/api/hub/workflows");
  const { data: receipts, loading, reload } = useApi<WorkflowReceipt[]>("/api/hub/receipts", ["receipt"]);
  const [workflowId, setWorkflowId] = useState("m1-demo");
  const [otp, setOtp] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const selected = useMemo(() => (receipts ?? []).find((r) => r.id === focus) ?? (receipts ?? [])[0], [receipts, focus]);

  const request = async () => {
    setBusy("request");
    try {
      const r = await api.post<{ receipt: WorkflowReceipt }>("/api/hub/workflows/request", {
        workflowId,
        workflowName: catalog?.canned?.[0]?.name,
        reason: `M1 phone Hub approved workflow for ${workflowId}`,
      });
      toast(`Approval requested (${r.receipt.id})`, "ok");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
      reload();
    } finally {
      setBusy(null);
    }
  };

  const act = async (id: string, path: string, body?: unknown) => {
    setBusy(path);
    try {
      await api.post(`/api/hub/receipts/${id}/${path}`, body ?? {});
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
      reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Hero
        title="Approvals & Receipts"
        subtitle="One canned workflow → approval gateway + OTP → verified completion receipt. Hub orchestrates; node executes."
      />

      <Section title="Request approved workflow">
        <div style={{ padding: "0 4px 12px", display: "grid", gap: 10 }}>
          <p style={{ color: "var(--muted, #9aa4b2)", fontSize: 13, margin: 0 }}>
            {catalog?.canned?.[0]?.description ?? "Approved n8n workflow run"} · {catalog?.note}
          </p>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13 }}>Workflow id (n8n)</span>
            <input
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              placeholder="n8n workflow id"
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #2a3442", background: "#111722", color: "#e6e9ef", fontSize: 16 }}
            />
          </label>
          <button type="button" className="chip" disabled={busy === "request"} onClick={() => void request()}>
            <Play size={14} /> {busy === "request" ? "Requesting…" : "Request approval"}
          </button>
        </div>
      </Section>

      <Section title="Active / latest" link="Refresh" onLink={() => void reload()}>
        {loading && !receipts ? (
          <Skeleton />
        ) : !selected ? (
          <Empty title="No receipts yet" hint="Request an approved workflow above." />
        ) : (
          <div style={{ padding: "0 4px 12px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Shield size={20} />
              <strong>{selected.workflowName}</strong>
              <Pill color={statusColor(selected.status)}>{selected.status}</Pill>
            </div>
            <div style={{ color: "var(--muted, #9aa4b2)", fontSize: 13, marginTop: 4 }}>
              {selected.workflowId} · approval {selected.approvalId ?? "—"} · {new Date(selected.requestedAt).toLocaleString()}
            </div>
            <Stepper status={selected.status} />

            {selected.otpRequired && selected.status === "pending" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <input
                  value={otp[selected.id] ?? ""}
                  onChange={(e) => setOtp((m) => ({ ...m, [selected.id]: e.target.value }))}
                  inputMode="numeric"
                  placeholder="SMS OTP"
                  aria-label="OTP"
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #2a3442", background: "#111722", color: "#e6e9ef", fontSize: 16, width: 140 }}
                />
                <button type="button" className="chip" onClick={() => void act(selected.id, "otp", { code: otp[selected.id] })}>
                  Submit OTP
                </button>
                <button type="button" className="chip" onClick={() => void act(selected.id, "refresh")}>
                  <Clock size={14} /> Refresh approval
                </button>
              </div>
            )}

            {(selected.status === "approved" || selected.status === "pending") && (
              <button type="button" className="chip" onClick={() => void act(selected.id, "running")} style={{ marginRight: 8 }}>
                Mark running on node
              </button>
            )}
            {selected.status === "running" && (
              <button
                type="button"
                className="chip"
                onClick={() => void act(selected.id, "complete", { ok: true, proof: `Node verified completion for ${selected.workflowId} at ${new Date().toISOString()}` })}
              >
                <CheckCircle2 size={14} /> Record verified receipt
              </button>
            )}

            {selected.proof && (
              <div style={{ marginTop: 12, background: "#151b26", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 650, marginBottom: 4 }}>Receipt</div>
                <code style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>{selected.proof}</code>
              </div>
            )}
            {selected.error && (
              <div style={{ marginTop: 12, color: "#ff453a", display: "flex", gap: 8 }}>
                <XCircle size={16} /> {selected.error}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Receipt ledger">
        {!receipts?.length ? (
          <Empty title="Ledger empty" hint="Completed and failed runs appear here." />
        ) : (
          <div className="list">
            {receipts.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate("receipts", undefined, { id: r.id })}
                style={{ display: "flex", width: "100%", textAlign: "left", gap: 12, padding: "12px 4px", border: 0, borderBottom: "1px solid var(--border, #1d2532)", background: "none", color: "inherit" }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{r.workflowName}</div>
                  <div style={{ color: "var(--muted, #9aa4b2)", fontSize: 13 }}>{r.id} · {new Date(r.updatedAt).toLocaleString()}</div>
                </div>
                <Pill color={statusColor(r.status)}>{r.status}</Pill>
              </button>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
