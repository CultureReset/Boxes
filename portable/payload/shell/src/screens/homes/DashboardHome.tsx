import { Calendar, AppWindow, Download, Sparkles } from "lucide-react";
import { useApi } from "../../api/client";
import type { Automation, CalendarEvent, Job, WindowEntry } from "../../api/types";
import { useStatus } from "../../state/status";
import { useWorld } from "../../state/world";
import { useLayout } from "../../state/layout";
import { Hero } from "../../components/Hero";
import { StatTile, FeatureTile } from "../../components/StatTile";
import { navigate } from "../../lib/router";
import { greeting, firstName } from "../../lib/format";
import { homeRow } from "../../modules/homeRows";
import type { ScreenProps } from "../../modules/registry";

/** The dark dashboard home: hero, stats strip, then the world's rows in order. */
export function DashboardHome({ onJob }: ScreenProps) {
  const { status } = useStatus();
  const { active } = useWorld();
  const { layout } = useLayout();
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const { data: events } = useApi<CalendarEvent[]>(`/api/calendar?from=${dayStart}&to=${dayEnd}`, ["calendar"]);
  const { data: windows } = useApi<WindowEntry[]>("/api/windows", ["windows"]);
  const { data: autos } = useApi<{ items: Automation[] }>("/api/automations", ["automations"]);
  const { data: jobs } = useApi<Job[]>("/api/jobs", ["job"]);
  const running = (autos?.items ?? []).filter((a) => a.enabled);
  const runningJobs = (jobs ?? []).filter((j) => j.status === "running");
  const name = active?.kind === "person" ? active.name : status ? firstName(status.user.fullName) : "";

  return (
    <>
      <Hero title={`${greeting()}, ${name}.`} subtitle={active?.tagline || "Everything that matters today, in one place."} />
      <div className="stats">
        <StatTile icon={<Calendar size={22} />} value={events ? events.length : "–"} label={`meeting${events?.length === 1 ? "" : "s"} today`} onClick={() => navigate("calendar")} />
        <StatTile icon={<AppWindow size={22} />} value={windows ? windows.length : "–"} label={`app${windows?.length === 1 ? "" : "s"} open`} onClick={() => navigate("apps")} />
        <StatTile icon={<Download size={22} />} value={status?.updates ?? "–"} label={status == null ? "updates available" : status.updates == null ? "updates: can\u2019t check" : status.updates === 1 ? "update available" : "updates available"} onClick={() => navigate("settings", "updates")} />
        <FeatureTile icon={<Sparkles size={22} />} title={runningJobs.length ? "Your AI agents are active" : "Your AI agents are ready"} subtitle={`${runningJobs.length ? `Working on ${runningJobs.length} · ` : ""}${running.length} automation${running.length === 1 ? "" : "s"} running`} onClick={() => navigate("agents")} />
      </div>
      {(layout?.rows ?? []).filter((r) => r.enabled).map((r) => {
        const mod = homeRow(r.id);
        if (!mod) return null;
        const Row = mod.component;
        return <Row key={r.id} onJob={onJob} />;
      })}
    </>
  );
}
