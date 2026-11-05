import { Shield } from "lucide-react";
import { useApi } from "../api/client";
import { Section } from "../components/Section";
import { ItemCard } from "../components/ItemCard";
import { navigate } from "../lib/router";
import { showAppView } from "../lib/openApp";
import type { RowProps } from "../modules/homeRows";
import type { HubInstalledApp } from "../api/types";

/** Home tile after CyberCheck install (M1c). Hidden when not registered. */
export function CyberCheckRow(_props: RowProps) {
  const { data } = useApi<HubInstalledApp[]>("/api/hub/installed", ["registry"]);
  const cc = (data ?? []).find((i) => i.manifestId === "cybercheck" && i.enabled);
  const twenty = (data ?? []).find((i) => i.manifestId === "twenty" && i.enabled);
  if (!cc && !twenty) return null;

  return (
    <Section title="Installed in Hub" link="App Store" onLink={() => navigate("store")}>
      <div className="grid">
        {twenty && (
          <ItemCard
            icon={<span className="app-icon" style={{ ["--ic" as string]: "#5e5ce6" }}>CRM</span>}
            title="Twenty CRM"
            subtitle="Integrated"
            onClick={() => showAppView({ kind: "native", slug: "twenty-crm", title: "Twenty CRM" })}
          />
        )}
        {cc && (
          <ItemCard
            icon={<span className="app-icon" style={{ ["--ic" as string]: "#30d158" }}><Shield size={26} /></span>}
            title="CyberCheck"
            subtitle="Native · owner check"
            onClick={() => navigate("cybercheck")}
          />
        )}
      </div>
    </Section>
  );
}
