import { useEffect, useState, type ReactNode } from "react";
import { door, type DoorMe } from "../lib/door";

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const u64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Sign in once (node-door). Nothing of NODE renders until the door says yes. */
export function DoorGate({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<DoorMe | null | undefined>(undefined);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const check = () => door.me().then(setMe).catch(() => setMe(null));
  useEffect(() => {
    void check();
    const out = () => setMe(null);
    window.addEventListener("node:signed-out", out);
    return () => window.removeEventListener("node:signed-out", out);
  }, []);
  if (me === undefined) return <div style={{ minHeight: "100vh", background: "#0b0f14" }} />;
  if (me) return <>{children}</>;
  const pw = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    try { await door.post("/auth/password/login", { email: f.get("email"), password: f.get("password") }); location.reload(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const pk = async () => {
    setErr(""); setBusy(true);
    try {
      const { k, options: o } = await door.post<{ k: string; options: any }>("/auth/login/options", {});
      o.challenge = b64(o.challenge); (o.allowCredentials || []).forEach((c: any) => (c.id = b64(c.id)));
      const a = (await navigator.credentials.get({ publicKey: o })) as any;
      const cred = { id: a.id, rawId: u64(a.rawId), type: a.type, response: { clientDataJSON: u64(a.response.clientDataJSON), authenticatorData: u64(a.response.authenticatorData), signature: u64(a.response.signature), userHandle: a.response.userHandle ? u64(a.response.userHandle) : null }, clientExtensionResults: {} };
      await door.post("/auth/login/verify", { k, cred }); location.reload();
    } catch (x) { setErr("Passkey sign-in failed: " + (x as Error).message); } finally { setBusy(false); }
  };
  const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #2a3442", background: "#111722", color: "#e6e9ef", fontSize: 16, boxSizing: "border-box" };
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0f14", color: "#e6e9ef", fontFamily: "system-ui", padding: 20 }}>
      <form onSubmit={pw} style={{ width: "100%", maxWidth: 360, display: "grid", gap: 12 }} aria-label="Sign in to NODE">
        <h1 style={{ letterSpacing: ".4em", textAlign: "center", margin: "0 0 8px" }}>NODE</h1>
        <input name="email" type="email" autoComplete="username" placeholder="Email" required style={inp} />
        <input name="password" type="password" autoComplete="current-password" placeholder="Password" required style={inp} />
        <button disabled={busy} style={{ ...inp, background: "#0a84ff", border: 0, fontWeight: 600 }}>Sign in</button>
        <button type="button" disabled={busy} onClick={() => void pk()} style={{ ...inp, background: "transparent" }}>Use a passkey</button>
        {err && <div role="alert" style={{ color: "#ff6b6b", textAlign: "center" }}>{err}</div>}
      </form>
    </div>
  );
}
