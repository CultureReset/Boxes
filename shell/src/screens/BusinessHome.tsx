import { useState } from "react";
import { CalendarDays, MessageSquare, ShieldCheck, Wallet, Check, X, Download, Sparkles, ChevronRight, CheckCircle2, CircleDashed, Activity as ActivityIcon } from "lucide-react";
import { api } from "../api/client";
import type { CalendarResult, HomeResult, Receipt, Settled } from "../api/nextgent";
import { useCloud, isoDay, toDate, timeOf, longDay, money, human } from "../lib/cloud";
import { greeting, timeAgo } from "../lib/format";
import { navigate } from "../lib/router";
import { useToast } from "../state/toast";
import { useNextgent } from "../state/nextgent";
import { SourceNote, LoadingRows, EmptyNote, OfflineBanner } from "../components/Cloud";
import { KIND_STYLE } from "./Calendar";

/**
 * Home for a paired computer: the business's day at a glance. Each tile and
 * list loads on its own; one that cannot load says why without taking the
 * rest down.
 */
export function BusinessHome() {
  const { state } = useNextgent();
  const today = isoDay(new Date());
  const home = useCloud<HomeResult>("/api/nextgent/home", ["calendar"], 60_000);
  const cal = useCloud<CalendarResult>(`/api/nextgent/calendar?from=${today}&to=${today}`, ["calendar"], 60_000);
  const h = home.data;
  const name = state?.company?.name ?? "";

  return (
    <>
      <header className="ng-head">
        <div>
          <p className="ng-eyebrow">{longDay(new Date())}</p>
          <h1>{greeting()}{name ? `, ${name}` : ""}.</h1>
        </div>
        <button type="button" className="btn lg" onClick={() => navigate("ask")}><Sparkles size={18} /> Ask</button>
      </header>
      <OfflineBanner />

      <div className="ng-stats">
        <Stat icon={<CalendarDays size={22} />} label="Bookings today" s={h?.bookings} loading={home.loading} value={(d) => d.length} onClick={() => navigate("calendar")} />
        <Stat icon={<MessageSquare size={22} />} label="Unread messages" s={h?.threads} loading={home.loading} value={(d) => d.filter((t) => t.unread).length} onClick={() => navigate("messages")} />
        <Stat icon={<ShieldCheck size={22} />} label="Waiting for you" s={h?.approvals} loading={home.loading} value={(d) => d.length} onClick={() => document.getElementById("attention")?.scrollIntoView({ behavior: "smooth" })} />
        <Stat
          icon={<Wallet size={22} />}
          label="Payments detected today"
          s={h?.payments}
          loading={home.loading}
          value={(d) => (d.length ? money(d.reduce((n, p) => n + (Number(p.amount_cents) || 0), 0), (d[0].currency as string) ?? null) : 0)}
          onClick={() => navigate("activity")}
        />
      </div>

      <div className="ng-columns">
        <section className="ng-panel" aria-labelledby="today-h">
          <div className="ng-panel-h">
            <h2 id="today-h">Today</h2>
            <button type="button" className="link" onClick={() => navigate("calendar")}>Calendar <ChevronRight size={16} /></button>
          </div>
          {cal.data?.offline && <p className="dim small">Saved copy{cal.data.savedAt ? ` from ${timeOf(new Date(cal.data.savedAt))}` : ""}.</p>}
          {cal.loading && !cal.data && <LoadingRows rows={3} h={56} />}
          {cal.failure && <SourceNote what="Today’s calendar" s={cal.failure} onRetry={cal.reload} />}
          {cal.data && cal.data.items.filter((i) => i.kind !== "approval").length === 0 && <EmptyNote title="Nothing scheduled today" hint="Bookings, events and agent work appear here as they come in." />}
          <ul className="ng-timeline">
            {(cal.data?.items ?? []).filter((i) => i.kind !== "approval").slice(0, 8).map((i) => {
              const d = toDate(i.start);
              const k = KIND_STYLE[i.kind];
              return (
                <li key={i.id}>
                  <button type="button" onClick={() => navigate("calendar", "day")}>
                    <span className="when">{i.allDay || !d ? "All day" : timeOf(d)}</span>
                    <span className="bar" style={{ background: k.color }} />
                    <span className="stack grow"><span className="t">{i.title}</span><span className="s">{[k.label, i.meta].filter(Boolean).join(" · ")}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="ng-panel" id="attention" aria-labelledby="att-h">
          <div className="ng-panel-h"><h2 id="att-h">Needs your attention</h2></div>
          <Attention home={h} loading={home.loading} reload={home.reload} />
        </section>
      </div>

      <div className="ng-columns">
        <section className="ng-panel" aria-labelledby="done-h">
          <div className="ng-panel-h">
            <h2 id="done-h">Done today</h2>
            <button type="button" className="link" onClick={() => navigate("activity")}>All activity <ChevronRight size={16} /></button>
          </div>
          <DoneToday s={h?.receipts} loading={home.loading} />
        </section>
        <section className="ng-panel" aria-labelledby="recent-h">
          <div className="ng-panel-h"><h2 id="recent-h">Recent activity</h2></div>
          {home.loading && !h && <LoadingRows rows={3} h={48} />}
          <SourceNote what="Activity" s={h?.activity} onRetry={home.reload} />
          {h?.activity?.state === "ok" && (h.activity.data ?? []).length === 0 && <EmptyNote title="No activity yet" />}
          <ul className="ng-list">
            {(h?.activity?.data ?? []).slice(0, 6).map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => navigate("activity")}>
                  <ActivityIcon size={18} />
                  <span className="grow t">{human(e.action)}</span>
                  <span className="s">{e.createdAt ? timeAgo(e.createdAt) : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Stat<T>({ icon, label, s, value, loading, onClick }: { icon: React.ReactNode; label: string; s: Settled<T[]> | undefined; value: (d: T[]) => React.ReactNode; loading: boolean; onClick: () => void }) {
  let shown: React.ReactNode = "–";
  let note = "";
  if (!s) note = loading ? "Loading…" : "";
  else if (s.state === "ok" && s.data) shown = value(s.data);
  else note = s.state === "offline" ? "Offline" : s.state === "not_connected" ? "Not connected yet" : s.state === "error" ? "Couldn’t load" : "Unavailable";
  return (
    <button type="button" className="card ng-stat" onClick={onClick}>
      <span className="ic">{icon}</span>
      <span className="n">{shown}</span>
      <span className="l">{label}</span>
      {note && <span className="note">{note}</span>}
    </button>
  );
}

function Attention({ home, loading, reload }: { home: HomeResult | null; loading: boolean; reload: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const approvals = home?.approvals?.data ?? [];
  const updates = home?.updates?.data ?? [];
  const unread = (home?.threads?.data ?? []).filter((t) => t.unread);

  const decide = async (id: string, yes: boolean) => {
    setBusy(id);
    try {
      await api.post(`/api/nextgent/approvals/${encodeURIComponent(id)}/${yes ? "approve" : "reject"}`, {});
      toast(yes ? "Approved" : "Declined");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message.replace(/^[a-z_]+: /, "") : "Could not send that", "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading && !home) return <LoadingRows rows={2} h={64} />;
  const nothing = home?.approvals?.state === "ok" && !approvals.length && !updates.length && !unread.length;
  return (
    <>
      <SourceNote what="Approvals" s={home?.approvals} onRetry={reload} />
      <ul className="ng-list">
        {approvals.slice(0, 5).map((a) => (
          <li key={a.id} className="ng-approval">
            <ShieldCheck size={20} />
            <span className="stack grow"><span className="t">{a.title}</span><span className="s">{a.createdAt ? `Asked ${timeAgo(a.createdAt)}` : "Waiting"}</span></span>
            <button type="button" className="btn" disabled={busy === a.id} onClick={() => void decide(a.id, false)}><X size={16} /> Decline</button>
            <button type="button" className="btn primary" disabled={busy === a.id} onClick={() => void decide(a.id, true)}>{busy === a.id ? <span className="spinner" /> : <Check size={16} />} Approve</button>
          </li>
        ))}
        {updates.slice(0, 3).map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => navigate("apps")}>
              <Download size={18} /><span className="stack grow"><span className="t">{i.name} update</span><span className="s">Version {i.latestVersion} is ready · approve it in the owner app</span></span>
            </button>
          </li>
        ))}
        {unread.slice(0, 3).map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => navigate("messages", t.id)}>
              <MessageSquare size={18} /><span className="stack grow"><span className="t">{t.contact || "New message"}</span><span className="s truncate">{t.last_message}</span></span>
            </button>
          </li>
        ))}
      </ul>
      {nothing && <EmptyNote icon={<CheckCircle2 size={28} />} title="You’re all caught up" hint="Approvals, updates and new messages show up here." />}
    </>
  );
}

function DoneToday({ s, loading }: { s: Settled<Receipt[]> | undefined; loading: boolean }) {
  if (loading && !s) return <LoadingRows rows={2} h={48} />;
  if (!s) return null;
  if (s.state !== "ok") return <SourceNote what="Receipts" s={s} />;
  const today = isoDay(new Date());
  const list = (s.data ?? []).filter((r) => String(r.at ?? r.createdAt ?? "").slice(0, 10) === today || isoDay(new Date(String(r.at ?? r.createdAt ?? 0))) === today);
  if (!list.length) return <EmptyNote title="Nothing done yet today" hint="Every real action an agent or this computer takes leaves a receipt here." />;
  return (
    <ul className="ng-list">
      {list.slice(0, 6).map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => navigate("activity", r.id)}>
            {r.verified ? <CheckCircle2 size={18} color="var(--green)" /> : <CircleDashed size={18} color="var(--orange)" />}
            <span className="grow t">{[human(r.action), r.target].filter(Boolean).join(" · ")}</span>
            <span className="s">{r.verified ? "Verified" : "Not verified"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
