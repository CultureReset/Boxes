import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

interface Toast {
  id: number;
  text: string;
  kind: "ok" | "error" | "info";
}

const Ctx = createContext<{ toast: (text: string, kind?: Toast["kind"]) => void }>({ toast: () => {} });
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = ++seq;
    setItems((l) => [...l, { id, text, kind }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === "error" ? 5000 : 2800);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === "ok" ? <CheckCircle2 size={16} color="var(--green)" /> : t.kind === "error" ? <AlertCircle size={16} color="var(--red)" /> : <Info size={16} color="var(--blue)" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx).toast;
}
