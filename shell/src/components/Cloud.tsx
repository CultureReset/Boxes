import { type ReactNode } from "react";
import { AlertTriangle, CloudOff, Link2, QrCode, RefreshCw, Settings2 } from "lucide-react";
import type { Settled, SourceState } from "../api/nextgent";
import { useNextgent } from "../state/nextgent";
import { navigate } from "../lib/router";
import { Skeleton } from "./ui";

/**
 * The four states every cloud-backed part of a screen can be in besides
 * "here it is": loading, empty, failed, and unavailable (offline, not paired,
 * not set up on this computer, not on the server yet). Each says which, in
 * plain words, and never fills the gap with made-up rows.
 */

export function Notice({ tone = "info", icon, children, action }: { tone?: "info" | "warn" | "error"; icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`ng-notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <span className="ng-notice-ic">{icon ?? (tone === "info" ? <Link2 size={20} /> : <AlertTriangle size={20} />)}</span>
      <span className="grow">{children}</span>
      {action}
    </div>
  );
}

const WORDS: Record<Exclude<SourceState, "ok">, (what: string) => string> = {
  offline: (w) => `${w} needs the internet. It comes back when the connection does.`,
  not_connected: (w) => `${w} isn’t connected on the server yet, so nothing shows here until it is.`,
  not_paired: (w) => `${w} shows once this computer is paired with your business.`,
  no_account: (w) => `${w} shows once this computer is linked to your account. That step isn’t available yet.`,
  not_configured: (w) => `${w} isn’t set up on this computer.`,
  error: (w) => `${w} couldn’t load.`,
};

/** One line for a source that is not "ok". Renders nothing when it is. */
export function SourceNote({ what, s, onRetry }: { what: string; s: Pick<Settled<unknown>, "state" | "error"> | undefined | null; onRetry?: () => void }) {
  if (!s || s.state === "ok") return null;
  const tone = s.state === "error" ? "error" : s.state === "offline" ? "warn" : "info";
  return (
    <Notice
      tone={tone}
      icon={s.state === "offline" ? <CloudOff size={20} /> : s.state === "not_configured" ? <Settings2 size={20} /> : undefined}
      action={onRetry && (s.state === "error" || s.state === "offline") ? <button type="button" className="btn sm" onClick={onRetry}><RefreshCw size={14} /> Retry</button> : undefined}
    >
      {WORDS[s.state](what)}
      {s.state === "error" && s.error ? <span className="dim"> {s.error}</span> : null}
    </Notice>
  );
}

export function LoadingRows({ rows = 3, h = 72 }: { rows?: number; h?: number }) {
  return (
    <div className="stack" style={{ gap: 12 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={h} />)}
    </div>
  );
}

export function EmptyNote({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="ng-empty">
      {icon}
      <div className="t">{title}</div>
      {hint && <div className="s">{hint}</div>}
    </div>
  );
}

/** Shown on every cloud screen while the internet is down: what still works, what does not. */
export function OfflineBanner() {
  const { state } = useNextgent();
  if (!state?.accountLinked || state.link.online !== false) return null;
  return (
    <Notice tone="warn" icon={<CloudOff size={20} />}>
      <b>Offline.</b> Today’s calendar is the copy saved on this computer. Agents, messages, Ask, approvals and app data need the internet and come back when it does. Files, settings and the phone screen still work.
    </Notice>
  );
}

/**
 * A cloud screen on a computer that is not paired, or paired but not yet able
 * to reach the account (that link is not decided yet — README, "Decisions needed").
 * Renders nothing when the screen can load.
 */
export function NeedsPairing({ what }: { what: string }) {
  const { state } = useNextgent();
  if (!state || state.accountLinked) return null;
  if (state.paired) {
    return (
      <div className="ng-empty big">
        <Link2 size={44} />
        <div className="t">This computer is paired, but can’t reach your account yet</div>
        <div className="s">{what} will show here once this computer can sign in to your account. That step isn’t available yet; everything on this computer itself still works.</div>
      </div>
    );
  }
  const configured = state.configured.gcr;
  return (
    <div className="ng-empty big">
      <QrCode size={44} />
      <div className="t">{what} appears once this computer is paired</div>
      <div className="s">{configured ? "Pairing signs this computer in to your business. It takes one scan from your phone." : "This computer has no cloud address set (NEXTGENT_GCR_API_URL)."}</div>
      {configured && <button type="button" className="btn primary" onClick={() => navigate("settings", "account")}><QrCode size={16} /> Pair this computer</button>}
    </div>
  );
}
