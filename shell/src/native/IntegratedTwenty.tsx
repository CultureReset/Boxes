import { useEffect, useMemo, useState, type ReactNode } from "react";
import { door } from "../lib/door";

/**
 * Integrated Twenty host (M1b): Hub chrome + Twenty REST via door
 * `/door/app/twenty/...` — not iframe-only login.
 *
 * Auth: reuse door/app session token. Token-exchange contract is TBD
 * (do not invent production SSO here).
 */

type Tab = "people" | "companies" | "opportunities" | "tasks" | "notes";

const box: React.CSSProperties = { padding: 16, color: "#e6e9ef", fontFamily: "system-ui", maxWidth: 960, margin: "0 auto" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderBottom: "1px solid #1d2532", alignItems: "center" };
const Msg = ({ children }: { children: ReactNode }) => <div style={{ padding: 16, color: "#9aa4b2" }}>{children}</div>;

function useLoad<T>(f: () => Promise<T>, dep: unknown) {
  const [s, set] = useState<{ d?: T; e?: string }>({});
  useEffect(() => {
    set({});
    f().then((d) => set({ d })).catch((e: Error) => set({ e: e.message }));
  }, [dep]);
  return s;
}

function Loaded<T>({ s, children }: { s: { d?: T; e?: string }; children: (d: T) => ReactNode }) {
  if (s.e) return <Msg>Couldn't reach Twenty through the door: {s.e}</Msg>;
  if (s.d === undefined) return <Msg>Loading CRM from the node…</Msg>;
  return <>{children(s.d)}</>;
}

function labelPerson(x: any): string {
  return `${x.name?.firstName ?? ""} ${x.name?.lastName ?? ""}`.trim() || x.emails?.primaryEmail || "(no name)";
}

function detailPerson(x: any): string {
  return [x.emails?.primaryEmail, x.jobTitle, x.city].filter(Boolean).join(" · ");
}

function labelCompany(x: any): string {
  return x.name || x.domainName?.primaryLinkUrl || "(company)";
}

function detailCompany(x: any): string {
  return [x.domainName?.primaryLinkUrl, x.employees, x.idealCustomerProfile ? "ICP" : ""].filter(Boolean).join(" · ");
}

function labelOpp(x: any): string {
  return x.name || "(opportunity)";
}

function detailOpp(x: any): string {
  const amt = x.amount?.amountMicros != null ? `$${(Number(x.amount.amountMicros) / 1_000_000).toLocaleString()}` : "";
  return [x.stage, amt, x.closeDate].filter(Boolean).join(" · ");
}

/** Search + tabbed CRM lists powered by Twenty REST through the door. */
export function IntegratedTwenty({ n = 0 }: { n?: number }) {
  const [tab, setTab] = useState<Tab>("people");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const path = useMemo(() => {
    const base = `/rest/${tab}?limit=80`;
    // Twenty filter syntax varies by object; keep M1 simple — client-side filter.
    return base;
  }, [tab]);

  const s = useLoad(() => door.app<any>("twenty", path), `${path}|${n}`);

  const items: any[] = useMemo(() => {
    const raw: any[] = s.d?.data?.[tab] ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return raw;
    return raw.filter((x) => JSON.stringify(x).toLowerCase().includes(needle));
  }, [s.d, tab, q]);

  const title = (x: any) =>
    tab === "people" ? labelPerson(x) : tab === "companies" ? labelCompany(x) : tab === "opportunities" ? labelOpp(x) : x.title || x.name || x.id;
  const detail = (x: any) =>
    tab === "people" ? detailPerson(x) : tab === "companies" ? detailCompany(x) : tab === "opportunities" ? detailOpp(x) : x.status || x.createdAt || "";

  return (
    <div style={box}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginRight: 8 }}>Twenty CRM</div>
        <span style={{ color: "#9aa4b2", fontSize: 13 }}>Integrated · via door /app/twenty</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {(["people", "companies", "opportunities", "tasks", "notes"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className="chip"
            onClick={() => { setTab(t); setSelected(null); }}
            style={{
              padding: "6px 12px",
              borderRadius: 16,
              border: 0,
              background: t === tab ? "#5e5ce6" : "#1d2532",
              color: "#fff",
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <label style={{ display: "block", marginBottom: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${tab}…`}
          aria-label={`Search ${tab}`}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #2a3442",
            background: "#111722",
            color: "#e6e9ef",
            fontSize: 16,
          }}
        />
      </label>

      {selected ? (
        <div style={{ marginBottom: 16 }}>
          <button type="button" onClick={() => setSelected(null)} style={{ background: "none", border: 0, color: "#0a84ff", marginBottom: 8 }}>
            ‹ Back to {tab}
          </button>
          <div style={{ background: "#151b26", borderRadius: 14, padding: 14 }}>
            <div style={{ fontWeight: 650, fontSize: 17, marginBottom: 8 }}>{title(selected)}</div>
            <div style={{ color: "#9aa4b2", marginBottom: 12 }}>{detail(selected)}</div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, color: "#c5ceda", maxHeight: 360, overflow: "auto" }}>
              {JSON.stringify(selected, null, 2)}
            </pre>
            <p style={{ color: "#9aa4b2", fontSize: 12, marginTop: 12 }}>
              Writes / mutations stay behind door session. Auth token-exchange TBD — do not paste API keys into the Hub UI.
            </p>
          </div>
        </div>
      ) : (
        <Loaded s={s}>
          {() => {
            if (!items.length) return <Msg>No {tab} yet{q ? " matching this search" : ""}.</Msg>;
            return (
              <div>
                {items.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setSelected(x)}
                    style={{ ...row, width: "100%", background: "none", color: "inherit", border: 0, borderBottom: "1px solid #1d2532", textAlign: "left", cursor: "pointer" }}
                  >
                    <span>{title(x)}</span>
                    <span style={{ color: "#9aa4b2", fontSize: 13, textAlign: "right" }}>{detail(x)}</span>
                  </button>
                ))}
              </div>
            );
          }}
        </Loaded>
      )}
    </div>
  );
}
