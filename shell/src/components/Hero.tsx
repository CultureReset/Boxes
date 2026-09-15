import { type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useStatus } from "../state/status";
import { HeroArt } from "./HeroArt";

export function Hero({ title, subtitle, crumb, onCrumb, right, tagline = "A more capable you." }: { title: ReactNode; subtitle?: ReactNode; crumb?: string; onCrumb?: () => void; right?: ReactNode; tagline?: string | null }) {
  const { status } = useStatus();
  return (
    <header className="hero">
      <div className="hero-art">{status?.background ? <img src={`/api/background?t=${encodeURIComponent(status.background)}`} alt="" /> : <HeroArt />}</div>
      <div>
        {crumb && (
          <button type="button" className="crumb" onClick={onCrumb}>
            <ChevronLeft size={16} /> {crumb}
          </button>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="sub">{subtitle}</p>}
      </div>
      {right ?? (tagline && <div className="tagline">{tagline}</div>)}
    </header>
  );
}
