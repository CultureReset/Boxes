import { isInstalled } from "./registry.js";
import { healthReport } from "./services.js";

export interface CyberCheckStatus {
  ok: boolean;
  installed: boolean;
  enabled: boolean;
  owner: { email?: string; role?: string; via?: string } | null;
  checks: Array<{ id: string; label: string; status: "pass" | "warn" | "fail" | "unknown"; detail?: string }>;
  checkedAt: string;
}

let last: CyberCheckStatus | null = null;

/** One useful native surface for M1: Hub install state + node health snapshot + owner hint. */
export async function cybercheckStatus(owner: CyberCheckStatus["owner"] = null): Promise<CyberCheckStatus> {
  const installed = await isInstalled("cybercheck");
  const checks: CyberCheckStatus["checks"] = [];

  checks.push({
    id: "hub-install",
    label: "Registered in Hub App Store",
    status: installed ? "pass" : "warn",
    detail: installed ? "CyberCheck native module is installed for this workspace." : "Install from App Store to enable the Home tile.",
  });

  checks.push({
    id: "owner",
    label: "Owner / door identity",
    status: owner?.email ? "pass" : "warn",
    detail: owner?.email ? `${owner.email} (${owner.role ?? "user"}) via ${owner.via ?? "door"}` : "No door identity attached to this status call yet.",
  });

  try {
    const health = await healthReport();
    const ok = Boolean(health);
    checks.push({
      id: "node-health",
      label: "Node health report",
      status: ok ? "pass" : "fail",
      detail: ok ? "Daemon healthReport() responded." : "healthReport() returned empty.",
    });
  } catch (e) {
    checks.push({
      id: "node-health",
      label: "Node health report",
      status: "fail",
      detail: (e as Error).message,
    });
  }

  // Ports frozen — only observe, never reconfigure.
  checks.push({
    id: "ports-frozen",
    label: "Node service ports (observe-only)",
    status: "pass",
    detail: "M1 does not change :3100/:4000/:5678/:7795 or frame 178xx.",
  });

  const fails = checks.filter((c) => c.status === "fail").length;
  last = {
    ok: fails === 0 && installed,
    installed,
    enabled: installed,
    owner,
    checks,
    checkedAt: new Date().toISOString(),
  };
  return last;
}

export async function runCybercheck(owner: CyberCheckStatus["owner"] = null): Promise<CyberCheckStatus> {
  return cybercheckStatus(owner);
}

export function lastCybercheck(): CyberCheckStatus | null {
  return last;
}
