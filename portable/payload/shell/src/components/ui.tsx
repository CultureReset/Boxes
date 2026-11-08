import { type ReactNode, type CSSProperties } from "react";
import { ChevronRight, ChevronDown, MoreHorizontal } from "lucide-react";

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} className={`toggle${on ? " on" : ""}`} disabled={disabled} onClick={() => onChange(!on)} />;
}

export function Slider({ value, onChange, min = 0, max = 100, onCommit }: { value: number; onChange: (v: number) => void; min?: number; max?: number; onCommit?: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="slider"
      min={min}
      max={max}
      value={value}
      style={{ "--pct": `${pct}%` } as CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
      onMouseUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onTouchEnd={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
    />
  );
}

export function Pill({ children, color, dot }: { children: ReactNode; color?: "green" | "orange" | "blue" | "red" | "purple"; dot?: boolean }) {
  return (
    <span className={`pill${color ? ` ${color}` : ""}`}>
      {dot && <span className="status-dot" style={{ background: "currentColor", width: 6, height: 6 }} />}
      {children}
    </span>
  );
}

export function Dot({ state }: { state: "on" | "warn" | "alert" | "info" | "off" }) {
  return <span className={`status-dot${state !== "off" ? ` ${state}` : ""}`} />;
}

export function Chevron({ size = 18 }: { size?: number }) {
  return <ChevronRight size={size} className="chev" />;
}

export function Caret({ size = 14 }: { size?: number }) {
  return <ChevronDown size={size} />;
}

export function MoreButton({ onClick, label = "More" }: { onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; label?: string }) {
  return (
    <button
      type="button"
      className="more"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(e);
      }}
    >
      <MoreHorizontal size={16} />
    </button>
  );
}

export function Segment<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="segment" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="empty">
      {icon}
      <div style={{ fontWeight: 500, color: "var(--text-2)" }}>{title}</div>
      {hint && <div className="small" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Skeleton({ h = 92, w }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w ?? "100%" }} />;
}
