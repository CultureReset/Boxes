import { useState } from "react";
import { Lock, Plus, Check } from "lucide-react";
import { useWorld } from "../state/world";
import { Sheet } from "./Sheet";
import { navigate } from "../lib/router";
import { useToast } from "../state/toast";

/** Row of profile avatars (the family mockup). Click switches; a lock asks for the PIN. */
export function ProfilesRow({ compact }: { compact?: boolean }) {
  const { worlds, active, switchTo } = useWorld();
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const toast = useToast();
  const go = async (id: string, p?: string) => {
    const r = await switchTo(id, p);
    if (r === "pin") setPinFor(id);
    else if (r === "wrong") toast("Wrong PIN", "error");
    else {
      setPinFor(null);
      setPin("");
      navigate("home");
    }
  };
  return (
    <>
      <div className="profiles" style={compact ? { padding: 0 } : undefined}>
        {worlds.map((w) => (
          <button key={w.id} type="button" className={`profile${active?.id === w.id ? " active" : ""}`} onClick={() => void go(w.id)} aria-label={`Switch to ${w.name}`}>
            <span className="av" style={{ ["--ic" as string]: w.color }}>{w.locked ? <Lock size={18} /> : w.name.charAt(0)}</span>
            {w.name}
          </button>
        ))}
        <button type="button" className="profile" onClick={() => navigate("settings", "worlds")} aria-label="Add world">
          <span className="av" style={{ ["--ic" as string]: "rgba(128,128,128,.35)" }}><Plus size={20} /></span>
          Add
        </button>
      </div>
      {pinFor && (
        <Sheet title={`Enter PIN for ${worlds.find((w) => w.id === pinFor)?.name}`} icon={<Lock size={18} />} onClose={() => setPinFor(null)} size="narrow" footer={<><button type="button" className="btn ghost" onClick={() => setPinFor(null)}>Cancel</button><button type="button" className="btn primary" disabled={pin.length < 4} onClick={() => void go(pinFor, pin)}><Check size={15} /> Switch</button></>}>
          <input className="input" type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} onKeyDown={(e) => e.key === "Enter" && pin.length >= 4 && void go(pinFor, pin)} placeholder="••••" style={{ fontSize: 24, letterSpacing: ".4em", textAlign: "center" }} />
        </Sheet>
      )}
    </>
  );
}
