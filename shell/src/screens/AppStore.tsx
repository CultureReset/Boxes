import { useMemo, useState } from "react";
import { Download, Check, Package, Shield, Users, Trash2 } from "lucide-react";
import { api, useApi } from "../api/client";
import { Hero } from "../components/Hero";
import { Section } from "../components/Section";
import { ItemCard } from "../components/ItemCard";
import { Empty, Skeleton, Pill } from "../components/ui";
import { useToast } from "../state/toast";
import { navigate } from "../lib/router";
import { showAppView } from "../lib/openApp";
import type { ScreenProps } from "../modules/registry";

/** Connect-first Hub App Store (M1a): install/register Twenty + CyberCheck only. */
export interface HubStoreApp {
  id: string;
  name: string;
  version: string;
  category?: string;
  notes?: string;
  installed: boolean;
  enabled: boolean;
  installable: boolean;
  frontend: { kind: "native" | "embedded" | "integrated"; nativeSlug?: string; screenId?: string; doorApp?: string };
  source: { kind: string; url?: string };
}

function iconFor(id: string) {
  if (id === "twenty") return <Users size={26} />;
  if (id === "cybercheck") return <Shield size={26} />;
  return <Package size={26} />;
}

export function AppStore(_props: ScreenProps) {
  const toast = useToast();
  const { data, loading, reload } = useApi<HubStoreApp[]>("/api/hub/store", ["registry"]);
  const { data: installed, reload: reloadInstalled } = useApi<Array<{ manifestId: string; enabled: boolean; manifest: HubStoreApp | null }>>("/api/hub/installed", ["registry"]);
  const [busy, setBusy] = useState<string | null>(null);

  const apps = useMemo(() => data ?? [], [data]);

  const install = async (id: string) => {
    setBusy(id);
    try {
      await api.post("/api/hub/install", { id });
      toast(`Registered ${id}`, "ok");
      reload();
      reloadInstalled();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const uninstall = async (id: string) => {
    setBusy(id);
    try {
      const r = await api.post<{ ok: boolean; message: string }>("/api/hub/uninstall", { id });
      toast(r.message, r.ok ? "ok" : "error");
      reload();
      reloadInstalled();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const openInstalled = (a: HubStoreApp) => {
    if (a.frontend.kind === "native" && a.frontend.screenId) {
      navigate(a.frontend.screenId);
      return;
    }
    // Integrated (Twenty) and native modules open inside Hub chrome via native host.
    if (a.frontend.kind === "integrated" || a.frontend.nativeSlug) {
      showAppView({ kind: "native", slug: a.frontend.nativeSlug || a.id, title: a.name });
      return;
    }
    if (a.source.url) {
      showAppView({ kind: "web", url: a.source.url, title: a.name });
    }
  };

  return (
    <>
      <Hero
        title="App Store"
        subtitle="Connect-first: register apps already running on this node. M1 installs Twenty CRM and CyberCheck only."
      />
      <Section title="Available for this node">
        {loading && !data ? (
          <Skeleton />
        ) : !apps.length ? (
          <Empty title="No manifests yet" hint="Add JSON files under config/app-manifests/." />
        ) : (
          <div className="grid">
            {apps.map((a) => (
              <ItemCard
                key={a.id}
                icon={<span className="app-icon" style={{ ["--ic" as string]: a.id === "twenty" ? "#5e5ce6" : "#30d158" }}>{iconFor(a.id)}</span>}
                title={a.name}
                subtitle={`${a.frontend.kind} · v${a.version}${a.category ? ` · ${a.category}` : ""}`}
                meta={
                  <>
                    {a.installed && a.enabled ? <Pill>Installed</Pill> : a.installed ? <Pill>Disabled</Pill> : <Pill>Not installed</Pill>}
                    {" "}
                    <span style={{ color: "var(--muted, #9aa4b2)", fontSize: 12 }}>{a.notes?.slice(0, 80) ?? a.source.kind}</span>
                  </>
                }
                onClick={() => (a.installed && a.enabled ? openInstalled(a) : void install(a.id))}
                onMore={(e) => {
                  e.stopPropagation();
                  if (a.installed) void uninstall(a.id);
                  else void install(a.id);
                }}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Installed in Hub">
        {!installed?.length ? (
          <Empty title="Nothing registered" hint="Install Twenty CRM or CyberCheck above. This does not start Docker — it registers the running / native app with Hub." />
        ) : (
          <div className="grid">
            {installed.map((i) => (
              <ItemCard
                key={i.manifestId}
                icon={<span className="app-icon">{iconFor(i.manifestId)}</span>}
                title={i.manifest?.name ?? i.manifestId}
                subtitle={i.enabled ? "Enabled" : "Disabled"}
                meta={<><Check size={14} /> {i.manifest?.frontend.kind ?? "app"}</>}
                onClick={() => i.manifest && openInstalled(i.manifest as HubStoreApp)}
              />
            ))}
          </div>
        )}
      </Section>

      <p style={{ padding: "8px 16px 24px", color: "var(--muted, #9aa4b2)", fontSize: 13 }}>
        {busy ? `Working on ${busy}…` : "No container engine in M1. CasaOS/Cosmos evaluation is later. Auth stays door-session; token-exchange TBD."}
        {" "}
        <button type="button" className="chip" onClick={() => navigate("apps")} style={{ marginLeft: 8 }}>
          <Download size={14} /> All Apps
        </button>
        {" "}
        <button type="button" className="chip" onClick={() => { reload(); reloadInstalled(); }} style={{ marginLeft: 4 }}>
          Refresh
        </button>
        <span style={{ display: "none" }}><Trash2 size={1} /></span>
      </p>
    </>
  );
}
