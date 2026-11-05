import { useMemo, useState } from "react";
import { Shield, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { api, useApi } from "../../api/client";
import { Hero } from "../../components/Hero";
import { Section } from "../../components/Section";
import { Empty, Pill, Skeleton } from "../../components/ui";
import { useToast } from "../../state/toast";
import type { ScreenProps } from "../registry";

/**
 * Native CyberCheck module (M1c) — one useful Hub surface:
 * owner/status check against the node registry + a lightweight local probe.
 * Full CyberCheck product stays in its own repos; this is Hub-native UI only.
 */

export interface CyberCheckStatus {
  ok: boolean;
  installed: boolean;
  enabled: boolean;
  owner: { email?: string; role?: string; via?: string } | null;
  checks: Array<{ id: string; label: string; status: "pass" | "warn" | "fail" | "unknown"; detail?: string }>;
  checkedAt: string;
}

export function CyberCheckApp(_props: ScreenProps) {
  const toast = useToast();
  const { data, loading, reload, error } = useApi<CyberCheckStatus>("/api/cybercheck/status", ["registry", "cybercheck"]);
  const [running, setRunning] = useState(false);

  const summary = useMemo(() => {
    if (!data) return null;
    const fails = data.checks.filter((c) => c.status === "fail").length;
    const warns = data.checks.filter((c) => c.status === "warn").length;
    if (fails) return { color: "red" as const, text: `${fails} check${fails === 1 ? "" : "s"} failed` };
    if (warns) return { color: "orange" as const, text: `${warns} warning${warns === 1 ? "" : "s"}` };
    return { color: "green" as const, text: "Owner checks look good" };
  }, [data]);

  const run = async () => {
    setRunning(true);
    try {
      await api.post("/api/cybercheck/run", {});
      toast("CyberCheck status refreshed", "ok");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <Hero
        title="CyberCheck"
        subtitle="Native Hub module — owner and node readiness. Install from the App Store to pin this on Home."
      />

      <Section title="Status" link="Refresh" onLink={() => void reload()}>
        {loading && !data ? (
          <Skeleton />
        ) : error ? (
          <Empty title="Couldn't load CyberCheck" hint={error} />
        ) : !data?.installed ? (
          <Empty title="CyberCheck not installed in Hub" hint="Open App Store → Install CyberCheck (connect-first native register)." />
        ) : (
          <div style={{ padding: "0 4px 12px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <span className="app-icon" style={{ ["--ic" as string]: "#30d158" }}><Shield size={26} /></span>
              <div>
                <div style={{ fontWeight: 650 }}>Owner check</div>
                <div style={{ color: "var(--muted, #9aa4b2)", fontSize: 13 }}>
                  {data.owner?.email ? `${data.owner.email} · ${data.owner.role ?? "user"} · via ${data.owner.via ?? "door"}` : "No door identity on this request"}
                </div>
              </div>
              {summary && <Pill color={summary.color} dot>{summary.text}</Pill>}
            </div>
            <button type="button" className="chip" disabled={running} onClick={() => void run()}>
              <RefreshCw size={14} /> {running ? "Checking…" : "Run owner check"}
            </button>
            <div style={{ color: "var(--muted, #9aa4b2)", fontSize: 12, marginTop: 8 }}>
              Last checked {data.checkedAt ? new Date(data.checkedAt).toLocaleString() : "—"}
            </div>
          </div>
        )}
      </Section>

      <Section title="Checks">
        {!data?.checks?.length ? (
          <Empty title="No checks yet" hint="Run owner check after installing CyberCheck." />
        ) : (
          <div className="list">
            {data.checks.map((c) => (
              <div key={c.id} className="row" style={{ display: "flex", gap: 12, padding: "12px 4px", borderBottom: "1px solid var(--border, #1d2532)", alignItems: "flex-start" }}>
                {c.status === "pass" ? <CheckCircle2 size={18} color="#30d158" /> : c.status === "fail" ? <AlertTriangle size={18} color="#ff453a" /> : <AlertTriangle size={18} color="#ff9f0a" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{c.label}</div>
                  {c.detail && <div style={{ color: "var(--muted, #9aa4b2)", fontSize: 13 }}>{c.detail}</div>}
                </div>
                <Pill color={c.status === "pass" ? "green" : c.status === "fail" ? "red" : "orange"}>{c.status}</Pill>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
