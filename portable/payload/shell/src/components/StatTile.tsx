import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function StatTile({ icon, value, label, onClick }: { icon: ReactNode; value: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button type="button" className="card stat" onClick={onClick}>
      <span style={{ color: "var(--text-2)", display: "grid" }}>{icon}</span>
      <span className="n">{value}</span>
      <span className="l">{label}</span>
      <ChevronRight size={18} className="chev" />
    </button>
  );
}

export function FeatureTile({ icon, title, subtitle, onClick }: { icon: ReactNode; title: string; subtitle: string; onClick?: () => void }) {
  return (
    <button type="button" className="card stat accent" onClick={onClick}>
      <span style={{ color: "var(--text)", display: "grid" }}>{icon}</span>
      <span className="stack">
        <span className="t">{title}</span>
        <span className="s">{subtitle}</span>
      </span>
      <ChevronRight size={18} className="chev" />
    </button>
  );
}
