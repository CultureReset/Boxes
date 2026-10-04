import { useEffect, useState } from "react";
import { CheckCircle2, QrCode, RefreshCw, Wifi } from "lucide-react";
import { api } from "../api/client";
import type { PairingView } from "../api/nextgent";
import { useNextgent } from "../state/nextgent";
import { navigate } from "../lib/router";
import { Notice } from "./Cloud";

/**
 * Sign-in for a TV (plan §11): this computer shows a QR and a short code; the
 * owner, already signed in to the owner app on their phone, confirms it there.
 * The computer never types a password and never picks its own business.
 */
export function PairPanel() {
  const { state, reload } = useNextgent();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const p: PairingView = state?.pairing ?? { phase: "idle" };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post<PairingView>("/api/nextgent/pair");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  if (!state.configured.gcr) {
    return (
      <Notice tone="info">
        This computer doesn’t know where its cloud is yet. The installer sets <code>NEXTGENT_GCR_API_URL</code>; once it is set, pairing appears here.
      </Notice>
    );
  }
  if (state.paired) {
    return (
      <Notice tone="info" icon={<CheckCircle2 size={20} color="var(--green)" />}>
        Paired{state.computer?.name ? ` as “${state.computer.name}”` : ""}. To remove it from your business, unlink it in the owner app under Computer.
      </Notice>
    );
  }

  const live = p.phase === "waiting";
  const left = p.expiresAt ? Math.max(0, Math.round((Date.parse(p.expiresAt) - now) / 1000)) : 0;
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <section className="ng-pair card" aria-live="polite">
      <div className="ng-pair-qr">
        {live && p.link ? <img src={`/api/nextgent/pair/qr.svg?c=${encodeURIComponent(p.userCode ?? "")}`} alt="Pairing QR code" /> : <div className="ng-pair-qr-blank"><QrCode size={72} /></div>}
      </div>
      <div className="ng-pair-body">
        <h2>Pair this computer</h2>
        {!live && (
          <>
            <p className="dim">Pairing adds this computer to your business. Show a code here, then confirm it on your phone in the owner app, where you’re already signed in.</p>
            {p.phase === "expired" && <Notice tone="warn">{p.message ?? "That code expired."}</Notice>}
            {p.phase === "error" && <Notice tone="error">{p.message}</Notice>}
            {error && <Notice tone="error">{error}</Notice>}
            <div className="row" style={{ gap: 12, marginTop: 8 }}>
              <button type="button" className="btn primary lg" disabled={busy} onClick={() => void start()}>
                {busy ? <span className="spinner" /> : p.phase === "idle" ? <QrCode size={18} /> : <RefreshCw size={18} />} {p.phase === "idle" ? "Show pairing code" : "Show a new code"}
              </button>
              <button type="button" className="btn lg" onClick={() => navigate("settings", "wifi")}><Wifi size={18} /> Network</button>
            </div>
          </>
        )}
        {live && (
          <>
            {p.userCode && <div className="ng-code" aria-label={`Code ${p.userCode.split("").join(" ")}`}>{p.userCode.match(/.{1,4}/g)?.join(" ")}</div>}
            <p className="dim">{p.link ? "Scan with your phone’s camera, or type the code in the owner app under Computer → Pair." : "Type this code in the owner app under Computer → Pair."}</p>
            <p className="dim small">Waiting for you to confirm · code expires in {mmss}</p>
          </>
        )}
      </div>
    </section>
  );
}
