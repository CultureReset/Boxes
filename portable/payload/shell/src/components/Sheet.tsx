import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Sheet({ title, icon, onClose, children, footer, size }: { title: ReactNode; icon?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "wide" | "narrow" }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sheet${size ? ` ${size}` : ""}`} role="dialog" aria-modal="true">
        <div className="sheet-h">
          {icon}
          <h3>{title}</h3>
          <button type="button" className="icon-btn close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="sheet-b">{children}</div>
        {footer && <div className="sheet-f">{footer}</div>}
      </div>
    </div>
  );
}
