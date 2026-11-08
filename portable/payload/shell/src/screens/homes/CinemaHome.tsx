import { useApi } from "../../api/client";
import type { AppEntry } from "../../api/types";
import { useStatus } from "../../state/status";
import { useWorld } from "../../state/world";
import { useLayout } from "../../state/layout";
import { greeting, firstName } from "../../lib/format";
import { HeroArt } from "../../components/HeroArt";
import { ProfilesRow } from "../../components/WorldSwitcher";
import { useShortcuts, ShortcutIcon } from "./shortcuts";
import { homeRow } from "../../modules/homeRows";
import type { ScreenProps } from "../../modules/registry";
import { AppIcon } from "../../components/AppIcon";

/** The dark, photo-forward "cinema" home: profiles, hero, big colour tiles, rows. */
export function CinemaHome({ onJob }: ScreenProps) {
  const { status } = useStatus();
  const { active } = useWorld();
  const { layout } = useLayout();
  const { run, shortcuts } = useShortcuts();
  const { data: apps } = useApi<AppEntry[]>("/api/apps", ["apps", "android"]);
  const name = active?.kind === "person" ? active.name : status ? firstName(status.user.fullName) : "";
  const rows = (layout?.rows ?? []).filter((r) => r.enabled && r.id !== "attention");
  return (
    <>
      <div style={{ paddingTop: 10 }}>
        <ProfilesRow />
      </div>
      <section className="cinema-hero">
        <div className="bg">{status?.background ? <img src={`/api/background?t=${encodeURIComponent(status.background)}`} alt="" /> : <HeroArt />}</div>
        <div className="script">A calmer,<br />brighter you.</div>
        <div className="inner">
          <div className="small">{greeting()},</div>
          <h1>{name}</h1>
          <div className="tag">{active?.tagline || "Big dreams. Brighter days."}</div>
        </div>
      </section>
      <div className="tiles">
        {shortcuts.slice(0, 4).map((s) => {
          const app = s.action.type === "app" ? apps?.find((a) => a.id === s.action.target) : undefined;
          return (
            <button key={s.id} type="button" className="tile" style={{ ["--ic" as string]: s.color }} onClick={() => run(s)}>
              {app?.icon ? <AppIcon icon={app.icon} name={app.name} color={app.color} size="sm" /> : <ShortcutIcon name={s.icon} size={30} />}
              <span className="stack"><span className="t">{s.label}</span><span className="s">{s.action.type === "agent" ? "Ask the agent" : s.action.type === "world" ? "Switch world" : s.action.type === "screen" ? "Open" : "Launch"}</span></span>
            </button>
          );
        })}
      </div>
      {rows.map((r) => {
        const mod = homeRow(r.id);
        if (!mod) return null;
        const Row = mod.component;
        return <Row key={r.id} onJob={onJob} />;
      })}
    </>
  );
}
