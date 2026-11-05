import { JsonStore, id } from "../store.js";
import { bus } from "../events.js";
import { HttpError } from "../router.js";

/**
 * Verified completion receipts for Hub (M1d).
 * Hub orchestrates; executor runs on the node after approval gateway + OTP.
 * Operator (Hermes vs OpenClaw) is undecided — do not migrate adapters here.
 */

export type ReceiptStatus = "requested" | "pending" | "approved" | "running" | "completed" | "failed" | "denied";

export interface WorkflowReceipt {
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
  meta?: Record<string, unknown>;
}

interface Doc {
  receipts: WorkflowReceipt[];
}

const store = new JsonStore<Doc>("hub-receipts", () => ({ receipts: [] }));

/** Canned M1 workflow: request n8n activate (or a named workflow) through approvals. */
export const M1_WORKFLOW = {
  id: "m1-approved-n8n",
  name: "Approved n8n workflow run",
  actionType: "n8n_activate",
  description: "Request approval (+ SMS OTP when required) then run one n8n workflow on the Linux node.",
};

export async function listReceipts(): Promise<WorkflowReceipt[]> {
  const doc = await store.read();
  return [...doc.receipts].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export async function getReceipt(rid: string): Promise<WorkflowReceipt | null> {
  return (await store.read()).receipts.find((r) => r.id === rid) ?? null;
}

export async function createReceiptRequest(input: {
  workflowId: string;
  workflowName?: string;
  actionType?: string;
  approvalId?: string;
  otpRequired?: boolean;
  meta?: Record<string, unknown>;
}): Promise<WorkflowReceipt> {
  const now = new Date().toISOString();
  const receipt: WorkflowReceipt = {
    id: id(),
    workflowId: input.workflowId,
    workflowName: input.workflowName ?? M1_WORKFLOW.name,
    actionType: input.actionType ?? M1_WORKFLOW.actionType,
    approvalId: input.approvalId,
    status: "pending",
    requestedAt: now,
    updatedAt: now,
    otpRequired: input.otpRequired ?? true,
    otpSubmitted: false,
    meta: input.meta,
  };
  const doc = await store.read();
  doc.receipts.unshift(receipt);
  await store.write(doc);
  bus.emit("receipt", { action: "create", id: receipt.id });
  return receipt;
}

export async function updateReceipt(
  rid: string,
  patch: Partial<Pick<WorkflowReceipt, "status" | "approvalId" | "otpSubmitted" | "proof" | "error" | "completedAt" | "meta">>,
): Promise<WorkflowReceipt> {
  const doc = await store.read();
  const r = doc.receipts.find((x) => x.id === rid);
  if (!r) throw new HttpError(404, "Receipt not found");
  Object.assign(r, patch, { updatedAt: new Date().toISOString() });
  if (patch.status === "completed" || patch.status === "failed" || patch.status === "denied") {
    r.completedAt = r.completedAt ?? new Date().toISOString();
  }
  await store.write(doc);
  bus.emit("receipt", { action: "update", id: rid, status: r.status });
  return r;
}
