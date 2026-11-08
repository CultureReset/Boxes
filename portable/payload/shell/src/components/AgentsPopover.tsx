import { useEffect, useRef, useState } from "react";
import { Sparkles, Zap, ChevronRight, Play } from "lucide-react";
import { api, useApi } from "../api/client";
import type { AgentsInfo, Automation } from "../api/types";
import { iconFor } from "../lib/icons";
import { navigate } from "../lib/router";

/**
 * The panel that rises from the ask bar's "Agents" button: the specialist
 * roster on one tab, automations on the other. Picking an agent sets the
 * persona for the next question; picking an automation runs it.
 */
export function AgentsPopover({ anchor, personas, onPick, onClose, onJob }: { anchor: DOMRect; personas: AgentsInfo["personas"]; onPick: (id: string) => void; onClose: () => void; onJob: (id: string) => void }) {
  const [tab, setTab] = useState<"agents" | "automations">("agents");
  const { data: autos } = useApi<{ items: Automation[] }>("/api/automations", ["automations"]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const width = Math.min(window.innerWidth * 0.92, 720);
  const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
  const bottom = window.innerHeight - anchor.top + 10;
  return (
    <div ref={ref} className="popover backdrop-layer" style={{ left, bottom }} role="dialog" aria-label="Agents and automations">
      <div className="ph">
        <button type="button" className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}><Sparkles size={15} /> Agents</button>
        <button type="button" className={tab === "automations" ? "active" : ""} onClick={() => setTab("automations")}><Zap size={15} /> Automations</button>
      </div>
      <div className="pb">
        {tab === "agents" &&
          personas.map((p) => {
            const Icon = iconFor(p.icon);
            return (
              <button key={p.id} type="button" className="list-row" onClick={() => { onPick(p.id); onClose(); }}>
                <span className="ic" style={{ ["--ic" as string]: p.color }}><Icon size={16} /></span>
                <span className="stack grow"><span className="t">{p.name}</span><span className="s truncate">{p.tagline}</span></span>
                <ChevronRight size={16} style={{ color: "rgba(255,255,255,.5)" }} />
              </button>
            );
          })}
        {tab === "automations" && (autos?.items ?? []).map((a) => {
          const Icon = iconFor(a.icon);
          return (
            <button key={a.id} type="button" className="list-row" onClick={() => { void api.post<{ jobId?: string }>(`/api/automations/${a.id}/run`).then((r) => r.jobId && onJob(r.jobId)); onClose(); }}>
              <span className="ic" style={{ ["--ic" as string]: a.enabled ? "#ff9f0a" : "#3a4250" }}><Icon size={16} /></span>
              <span className="stack grow"><span className="t">{a.name}</span><span className="s truncate">{a.description || (a.enabled ? "Active" : "Paused")}</span></span>
              <Play size={14} style={{ color: "rgba(255,255,255,.5)" }} />
            </button>
          );
        })}
        {tab === "automations" && autos && autos.items.length === 0 && (
          <button type="button" className="list-row" onClick={() => { navigate("automations"); onClose(); }}>
            <span className="ic" style={{ ["--ic" as string]: "#3a4250" }}><Zap size={16} /></span>
            <span className="stack grow"><span className="t">No automations yet</span><span className="s">Browse templates</span></span>
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
