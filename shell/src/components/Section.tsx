import { type ReactNode } from "react";
import { ChevronRight, ArrowRight } from "lucide-react";

export function Section({ title, onTitle, link, onLink, children, grid }: { title: string; onTitle?: () => void; link?: string; onLink?: () => void; children: ReactNode; grid?: boolean }) {
  return (
    <section className="section">
      <div className="section-h">
        {onTitle ? (
          <button type="button" onClick={onTitle}>
            <h2>
              {title} <ChevronRight size={18} />
            </h2>
          </button>
        ) : (
          <h2>{title}</h2>
        )}
        {link && (
          <button type="button" className="link" onClick={onLink}>
            {link} <ArrowRight size={14} />
          </button>
        )}
      </div>
      {grid ? <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>{children}</div> : <div className="hscroll">{children}</div>}
    </section>
  );
}
