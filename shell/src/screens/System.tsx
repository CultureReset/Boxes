import { Cpu, HardDrive, MemoryStick, Wifi, Folder, Activity } from "lucide-react";
import { useApi } from "../api/client";
import type { ControlStatus, ServicesReport, Status } from "../api/types";
import { useStatus } from "../state/status";
import { Hero } from "../components/Hero";
import type { ScreenProps } from "../modules/registry";

interface SysInfo { kernel?: string; distro?: string; memory?: string; cpu?: string; arch?: string; hostname?: string }

export function System(_props: ScreenProps) {
  const { status } = useStatus();
  const { data: sys } = useApi<SysInfo>("/api/system");
  const { data: services } = useApi<ServicesReport>("/api/services", ["services"]);
  const { data: control } = useApi<ControlStatus[]>("/api/control", ["control"]);
  return (
    <div className="clean-home">
      <Hero title="System" subtitle="Vitals and everything running on this computer." />
      <div className="clean-vitals" style={{ marginBottom: 28 }}>
        <Vital icon={<Cpu size={16} />} label="CPU" value={sys?.cpu ?? "—"} />
        <Vital icon={<MemoryStick size={16} />} label="Memory" value={sys?.memory ?? "—"} />
        <Vital icon={<HardDrive size={16} />} label="System" value={sys?.distro ?? "—"} />
        <Vital icon={<Wifi size={16} />} label="Network" value={netLabel(status)} />
        <Vital icon={<Activity size={16} />} label="Uptime" value={status?.uptimeSeconds != null ? `${Math.floor(status.uptimeSeconds / 3600)}h` : "—"} />
        <Vital icon={<Folder size={16} />} label="Updates" value={status?.updates == null ? "Can't check" : String(status.updates)} />
      </div>
      <p className="dim" style={{ marginBottom: 22 }}>GPU temperature, live utilization and power draw ship with the node-vitals module when it is installed. This page always shows what the daemon already reports.</p>
      <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>Services</h2>
      <div className="clean-list">
        {(control ?? []).map((c) => (
          <div key={c.id} className="clean-row" style={{ cursor: "default" }}>
            <span className="stack"><span className="t">{c.name}</span><span className="s">{c.why}</span></span>
            <span className="pill">{c.status}</span>
          </div>
        ))}
        {(services?.services ?? []).slice(0, 24).map((s) => (
          <div key={`${s.kind}:${s.name}`} className="clean-row" style={{ cursor: "default" }}>
            <span className="stack"><span className="t">{s.name}</span><span className="s">{s.description}</span></span>
            <span className="pill">{s.running ? "Running" : s.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Vital({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="clean-vital">
      <span className="clean-vital-l">{icon} {label}</span>
      <span className="t">{value}</span>
    </div>
  );
}

function netLabel(status: Status | null | undefined): string {
  if (!status?.network) return "—";
  if (!status.network.online) return "Offline";
  return status.network.type === "wifi" ? status.network.ssid || "Wi-Fi" : "Ethernet";
}
