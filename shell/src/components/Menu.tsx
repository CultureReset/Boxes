import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
}

/** Context menu anchored to a click point; flips to stay on screen. */
export function Menu({ at, items, onClose }: { at: { x: number; y: number }; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.min(at.x, window.innerWidth - r.width - 8), y: Math.min(at.y, window.innerHeight - r.height - 8) });
  }, [at]);
  useEffect(() => {
    const close = () => onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="menu" style={{ left: pos.x, top: pos.y }} onMouseDown={(e) => e.stopPropagation()} role="menu">
      {items.map((it, i) =>
        it.divider ? (
          <hr key={i} />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={it.danger ? "danger" : ""}
            onClick={() => {
              it.onClick?.();
              onClose();
            }}
          >
            {it.icon}
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}

export function useMenu() {
  const [state, setState] = useState<{ at: { x: number; y: number }; items: MenuItem[] } | null>(null);
  const open = (e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ at: { x: e.clientX, y: e.clientY }, items });
  };
  const element = state ? <Menu at={state.at} items={state.items} onClose={() => setState(null)} /> : null;
  return { open, element };
}
