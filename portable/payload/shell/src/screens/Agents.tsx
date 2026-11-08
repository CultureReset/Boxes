import { Sparkles, Bot, Play, CheckCircle2, Clock, MessageSquare, Zap, Download, XCircle, Check } from "lucide-react";
import { api, useApi } from "../api/client";
import type { AgentsInfo, Automation, Job } from "../api/types";
import { Hero } from "../components/Hero";
import { StatTile, FeatureTile } from "../components/StatTile";
import { Section } from "../components/Section";
import { ItemCard } from "../components/ItemCard";
import { Pill } from "../components/ui";
import { navigate } from "../lib/router";
import { timeAgo } from "../lib/format";
import { iconFor } from "../lib/icons";
import { useToast } from "../state/toast";
import { useWorld } from "../state/world";
import type { ScreenProps } from "../modules/registry";

export function askWith(persona: string) {
  window.dispatchEvent(new CustomEvent("node:ask", { detail: { persona } }));
}

/** The specialised-agent workforce: every agent has a narrow role and a listed scope. */
export function Agents({ onJob }: ScreenProps) {
  const { data: info } = useApi<AgentsInfo>("/api/agents", ["world"]);
  const { data: autos } = useApi<{ items: Automation[]; templates: Omit<Automation, "id">[] }>("/api/automations", ["automations", "world"]);
  const { data: jobs } = useApi<Job[]>("/api/jobs", ["job"]);
  const { active } = useWorld();
  const toast = useToast();
  const running = (autos?.items ?? []).filter((a) => a.enabled);
  const doneToday = (jobs ?? []).filter((j) => j.status !== "running" && new Date(j.startedAt).toDateString() === new Date().toDateString()).length;
  const installed = (info?.providers ?? []).filter((p) => p.installed);
  const personas = (info?.personas ?? []).filter((p) => p.id !== "auto");

  return (
    <>
      <Hero title="Your AI agents, ready to work." subtitle="Experts for every job. Each has a narrow role and limited authority, and works through the Orchestrator." />
      <div className="stats">
        <StatTile icon={<Bot size={22} />} value={personas.length || "–"} label={`agents in ${active?.name ?? "this world"}`} />
        <StatTile icon={<Play size={22} />} value={running.length} label="automations running" onClick={() => navigate("automations")} />
        <StatTile icon={<Clock size={22} />} value={doneToday} label="tasks completed today" />
        <FeatureTile icon={<Sparkles size={22} />} title={installed.length ? `Powered by ${installed.find((p) => p.isDefault)?.name ?? installed[0].name}` : "Add an AI engine"} subtitle={installed.length ? "Runs locally, no terminal" : "Claude Code, Codex or OpenCode"} onClick={() => navigate("apps")} />
      </div>

      <section className="section">
        <div className="section-h"><h2>The workforce</h2><button type="button" className="link" onClick={() => askWith("auto")}>Ask the Orchestrator <Sparkles size={14} /></button></div>
        <div className="roster">
          {personas.map((p) => {
            const Icon = iconFor(p.icon);
            return (
              <div key={p.id} className="card">
                <div className="rh">
                  <span className="app-icon sm" style={{ ["--ic" as string]: p.color }}><Icon size={20} /></span>
                  <span className="stack"><span className="t">{p.name} Agent</span><span className="s">{p.tagline}</span></span>
                </div>
                <ul>{p.scope.map((s) => <li key={s}><Check size={14} /> {s}</li>)}</ul>
                <div className="foot">
                  <span>{p.description}</span>
                  <button type="button" className="btn sm pillbtn" onClick={() => askWith(p.id)}>Ask <Play size={11} /></button>
                </div>
              </div>
            );
          })}
          {info && personas.length === 0 && <div className="empty">No agents are allowed in this world. Change that in Settings → People & Worlds.</div>}
        </div>
      </section>

      <Section title="Automations Running" onTitle={() => navigate("automations")} link="View all automations" onLink={() => navigate("automations")}>
        {(autos?.items ?? []).map((a) => {
          const Icon = iconFor(a.icon);
          return <ItemCard key={a.id} icon={<span className="app-icon" style={{ ["--ic" as string]: "#2b2f3a" }}><Icon size={26} /></span>} title={a.name} subtitle={a.description} meta={<><span>{a.enabled ? <Pill color="green" dot>Active</Pill> : <Pill color="orange" dot>Paused</Pill>}</span> <span className="tiny">{a.nextRun ? `Next ${new Date(a.nextRun).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "Manual"}</span></>} onClick={() => navigate("automations")} />;
        })}
        {autos && autos.items.length === 0 && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: "#2b2f3a" }}><Zap size={26} /></span>} title="No automations yet" subtitle="Add one from the suggestions below" onClick={() => navigate("automations")} chevron />}
      </Section>

      <Section title="Suggested Automations" link="Browse templates" onLink={() => navigate("automations")}>
        {(autos?.templates ?? []).filter((t) => !autos?.items.some((i) => i.name === t.name)).slice(0, 6).map((t) => {
          const Icon = iconFor(t.icon);
          return <ItemCard key={t.name} icon={<span className="app-icon" style={{ ["--ic" as string]: "#2b2f3a" }}><Icon size={26} /></span>} title={t.name} subtitle={t.description} action={<button type="button" className="btn sm" onClick={() => void api.post("/api/automations", t).then(() => toast(`Added ${t.name}`))}>Add +</button>} />;
        })}
      </Section>

      <Section title="Recent Activity">
        {(jobs ?? []).slice(0, 8).map((j) => (
          <ItemCard key={j.id} icon={<span className="app-icon" style={{ ["--ic" as string]: j.kind === "agent" ? "#8e5cf6" : j.kind === "install" ? "#0a84ff" : "#30d158" }}>{j.kind === "agent" ? <MessageSquare size={24} /> : j.kind === "automation" ? <Zap size={24} /> : <Download size={24} />}</span>} title={j.kind === "agent" ? `You asked ${String(j.meta?.persona ?? "General").replace(/^\w/, (c) => c.toUpperCase())}` : j.title} subtitle={j.kind === "agent" ? `“${j.title}”` : j.lines[j.lines.length - 1] ?? ""} meta={<>{j.status === "running" ? <span className="spinner" style={{ width: 10, height: 10 }} /> : j.status === "done" ? <CheckCircle2 size={12} color="var(--green)" /> : <XCircle size={12} color="var(--red)" />} {timeAgo(j.startedAt)}</>} onClick={() => onJob(j.id)} chevron />
        ))}
        {jobs && jobs.length === 0 && <ItemCard icon={<span className="app-icon" style={{ ["--ic" as string]: "#8e5cf6" }}><Sparkles size={26} /></span>} title="Ask your first question" subtitle="Type anything in the bar below" onClick={() => askWith("auto")} />}
      </Section>
    </>
  );
}
