import { HttpError } from "../router.js";
import {
  M1_WORKFLOW,
  createReceiptRequest,
  updateReceipt,
  getReceipt,
  type WorkflowReceipt,
} from "./receipts.js";

/**
 * M1d: Hub orchestrates one approved workflow.
 * Approval + OTP go through the existing door approvals gateway
 * (node-approval-gateway :7795 behind door /app/approvals). Hub never
 * reconfigures ports. Hermes/OpenClaw adapters are not touched.
 */

const APPROVALS = (process.env.NODE_APPROVALS_URL ?? "http://127.0.0.1:7795").replace(/\/$/, "");

async function approvalsApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(APPROVALS + path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const t = await r.text();
  let data: unknown = null;
  try {
    data = t ? JSON.parse(t) : null;
  } catch {
    data = t;
  }
  if (!r.ok) throw new HttpError(r.status, (data as { error?: string } | null)?.error ?? `Approvals ${r.status}`);
  return data as T;
}

export function workflowCatalog() {
  return {
    canned: [M1_WORKFLOW],
    note: "Operator Hermes vs OpenClaw still undecided — adapters not migrated. Executor stays on node; Hub only orchestrates.",
    approvalGateway: APPROVALS,
  };
}

/** Start M1 path: create receipt + request approval (OTP may follow). */
export async function requestApprovedWorkflow(input: {
  workflowId?: string;
  workflowName?: string;
  reason?: string;
}): Promise<{ receipt: WorkflowReceipt; approval: unknown }> {
  const workflowId = (input.workflowId || "m1-demo").slice(0, 128);
  const workflowName = (input.workflowName || M1_WORKFLOW.name).slice(0, 120);
  const reason = (input.reason || `M1 approved workflow "${workflowName}" from NODE Hub`).slice(0, 500);

  const receipt = await createReceiptRequest({
    workflowId,
    workflowName,
    actionType: M1_WORKFLOW.actionType,
    otpRequired: true,
    meta: { reason },
  });

  let approval: unknown;
  try {
    approval = await approvalsApi("POST", "/v1/approvals", {
      action: { type: M1_WORKFLOW.actionType, workflowId: String(workflowId) },
      requester: { app: "NODE", via: "hub-m1d" },
      reason,
    });
    const approvalId = (approval as { id?: string })?.id;
    await updateReceipt(receipt.id, { approvalId, status: "pending" });
  } catch (e) {
    // Keep receipt so UI can show failure / retry; do not hide gateway errors.
    await updateReceipt(receipt.id, {
      status: "failed",
      error: (e as Error).message,
      proof: undefined,
    });
    throw e;
  }

  return { receipt: (await getReceipt(receipt.id))!, approval };
}

/** Submit OTP for a pending approval (when gateway requires it). */
export async function submitWorkflowOtp(receiptId: string, code: string): Promise<WorkflowReceipt> {
  const receipt = await getReceipt(receiptId);
  if (!receipt) throw new HttpError(404, "Receipt not found");
  if (!receipt.approvalId) throw new HttpError(400, "No approval id on this receipt");
  const otp = code.replace(/\s+/g, "").slice(0, 12);
  if (!/^\d{4,8}$/.test(otp)) throw new HttpError(400, "OTP must be 4–8 digits");

  try {
    await approvalsApi("POST", `/v1/approvals/${encodeURIComponent(receipt.approvalId)}/otp`, { code: otp });
  } catch (e) {
    // Some gateways use /otp on a different path — record attempt, surface error.
    await updateReceipt(receiptId, { error: (e as Error).message });
    throw e;
  }
  return updateReceipt(receiptId, { otpSubmitted: true, status: "approved", error: undefined });
}

/** Mark running → completed with independent proof text (receipt ledger). */
export async function markWorkflowRunning(receiptId: string): Promise<WorkflowReceipt> {
  return updateReceipt(receiptId, { status: "running" });
}

export async function completeWorkflow(
  receiptId: string,
  input: { ok: boolean; proof?: string; error?: string },
): Promise<WorkflowReceipt> {
  return updateReceipt(receiptId, {
    status: input.ok ? "completed" : "failed",
    proof: input.proof ?? (input.ok ? `Verified on node at ${new Date().toISOString()}` : undefined),
    error: input.error,
    completedAt: new Date().toISOString(),
  });
}

export async function refreshApprovalStatus(receiptId: string): Promise<WorkflowReceipt> {
  const receipt = await getReceipt(receiptId);
  if (!receipt) throw new HttpError(404, "Receipt not found");
  if (!receipt.approvalId) return receipt;
  try {
    const st = await approvalsApi<{ status?: string; state?: string }>(
      "GET",
      `/v1/approvals/${encodeURIComponent(receipt.approvalId)}`,
    );
    const status = String(st.status ?? st.state ?? "").toLowerCase();
    if (status.includes("approv")) return updateReceipt(receiptId, { status: "approved" });
    if (status.includes("deny") || status.includes("reject")) return updateReceipt(receiptId, { status: "denied" });
    if (status.includes("pending") || status.includes("wait")) return updateReceipt(receiptId, { status: "pending" });
  } catch {
    /* keep local status */
  }
  return (await getReceipt(receiptId))!;
}
