import { useEffect, useState, type ReactNode } from "react";
import { door, DOOR as DOOR_BASE } from "../lib/door";

/** NODE-native screens for apps whose own UI can't be shown signed-in inside
 *  NODE (frame-blocking headers / their own login). Data comes from each app's
 *  API through the door (/door/app/<name>/...), credentials injected on the PC. */
export const NATIVE: Record<string, true> = Object.fromEntries(
  ["twenty-crm", "navidrome", "uptime-kuma", "n8n", "litellm", "crawl4ai", "openclaw", "minidlna", "openjarvis", "paperclip", "searxng", "llama-swap", "mcp"].map((k) => [k, true]),
) as Record<string, true>;

/** Any in-app "open URL" for one of NODE's apps goes to its NODE screen, never the app's own page/login. */
const PORT_SLUG: Record<string, string> = {
  "3000": "twenty-crm", "6443": "twenty-crm", "26443": "twenty-crm", "5678": "n8n", "5443": "n8n", "25443": "n8n",
  "4000": "litellm", "3443": "litellm", "23443": "litellm", "3100": "paperclip", "10443": "paperclip", "30443": "paperclip",
  "5173": "openjarvis", "8000": "openjarvis", "20443": "openjarvis", "18789": "openclaw", "11443": "openclaw", "31443": "openclaw",
  "3002": "uptime-kuma", "7443": "uptime-kuma", "27443": "uptime-kuma", "4533": "navidrome", "4443": "navidrome", "24443": "navidrome",
  "8888": "searxng", "9443": "searxng", "29443": "searxng", "11235": "crawl4ai", "12443": "crawl4ai", "32443": "crawl4ai",
  "8080": "llama-swap", "13443": "llama-swap", "33443": "llama-swap", "8200": "minidlna", "10000": "mcp",
};
export function nativeFor(url: string): string | null {
  try { const u = new URL(url, location.href); if (u.origin === location.origin) return null; return PORT_SLUG[u.port] ?? (u.hostname.endsWith(".ts.net") && !u.port ? "openjarvis" : null); } catch { return null; }
}

function useLoad<T>(f: () => Promise<T>, dep: unknown) {
  const [s, set] = useState<{ d?: T; e?: string }>({});
  useEffect(() => { set({}); f().then((d) => set({ d })).catch((e: Error) => set({ e: e.message })); }, [dep]);
  return s;
}
const box: React.CSSProperties = { padding: 16, color: "#e6e9ef", fontFamily: "system-ui", maxWidth: 900, margin: "0 auto" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderBottom: "1px solid #1d2532" };
const Msg = ({ children }: { children: ReactNode }) => <div style={{ padding: 16, color: "#9aa4b2" }}>{children}</div>;
function Loaded<T>({ s, children }: { s: { d?: T; e?: string }; children: (d: T) => ReactNode }) {
  if (s.e) return <Msg>Couldn't load from the PC: {s.e}</Msg>;
  if (s.d === undefined) return <Msg>Loading from the PC…</Msg>;
  return <>{children(s.d)}</>;
}

function Twenty({ n }: { n: number }) {
  const [tab, setTab] = useState<"people" | "companies" | "opportunities">("people");
  const s = useLoad(() => door.app<any>("twenty", `/rest/${tab}?limit=60`), `${tab}${n}`);
  return (
    <div style={box}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["people", "companies", "opportunities"] as const).map((t) => (
          <button key={t} type="button" className="chip" onClick={() => setTab(t)} style={{ padding: "6px 12px", borderRadius: 16, border: 0, background: t === tab ? "#5e5ce6" : "#1d2532", color: "#fff", textTransform: "capitalize" }}>{t}</button>
        ))}
      </div>
      <Loaded s={s}>{(d) => {
        const items: any[] = d?.data?.[tab] ?? [];
        if (!items.length) return <Msg>No {tab} yet.</Msg>;
        return <div>{items.map((x) => (
          <div key={x.id} style={row}>
            <span>{tab === "people" ? `${x.name?.firstName ?? ""} ${x.name?.lastName ?? ""}`.trim() || "(no name)" : x.name}</span>
            <span style={{ color: "#9aa4b2" }}>{tab === "people" ? x.emails?.primaryEmail : tab === "companies" ? x.domainName?.primaryLinkUrl : x.stage}</span>
          </div>))}</div>;
      }}</Loaded>
    </div>
  );
}

function Navidrome({ n }: { n: number }) {
  const [play, setPlay] = useState<{ id: string; title: string } | null>(null);
  const [album, setAlbum] = useState<string | null>(null);
  const s = useLoad(() => door.app<any>("navidrome", album ? `/rest/getAlbum?id=${encodeURIComponent(album)}` : "/rest/getAlbumList2?type=alphabeticalByName&size=200"), `${album}${n}`);
  const scan = useLoad(() => door.app<any>("navidrome", "/rest/getScanStatus"), n);
  return (
    <div style={box}>
      {play && <audio controls autoPlay src={door.appUrl("navidrome", `/rest/stream?id=${encodeURIComponent(play.id)}`)} style={{ width: "100%", marginBottom: 12 }} aria-label={play.title} />}
      {album && <button type="button" onClick={() => setAlbum(null)} style={{ marginBottom: 8, background: "none", border: 0, color: "#0a84ff" }}>‹ All albums</button>}
      <Loaded s={s}>{(d) => {
        const r = d?.["subsonic-response"] ?? {};
        if (album) return <div>{(r.album?.song ?? []).map((x: any) => (
          <button type="button" key={x.id} onClick={() => setPlay({ id: x.id, title: x.title })} style={{ ...row, width: "100%", background: "none", color: "inherit", border: 0, borderBottom: "1px solid #1d2532", textAlign: "left" }}>
            <span>{x.track ? `${x.track}. ` : ""}{x.title}</span><span style={{ color: "#9aa4b2" }}>{x.artist}</span></button>))}</div>;
        const al: any[] = r.albumList2?.album ?? [];
        if (!al.length) return <Msg>The music library is empty{scan.d ? ` (${scan.d?.["subsonic-response"]?.scanStatus?.count ?? 0} songs scanned)` : ""}.</Msg>;
        return <div>{al.map((x) => (
          <button type="button" key={x.id} onClick={() => setAlbum(x.id)} style={{ ...row, width: "100%", background: "none", color: "inherit", border: 0, borderBottom: "1px solid #1d2532", textAlign: "left" }}>
            <span>{x.name}</span><span style={{ color: "#9aa4b2" }}>{x.artist}</span></button>))}</div>;
      }}</Loaded>
    </div>
  );
}

function Kuma({ n }: { n: number }) {
  const s = useLoad(() => door.appText("uptime-kuma", "/metrics"), n);
  return <div style={box}><Loaded s={s}>{(t) => {
    const ms = [...t.matchAll(/^monitor_status\{([^}]*)\}\s+(\S+)/gm)].map((m) => ({ name: /monitor_name="([^"]*)"/.exec(m[1])?.[1] ?? "?", url: /monitor_url="([^"]*)"/.exec(m[1])?.[1] ?? "", v: Number(m[2]) }));
    const rt = new Map([...t.matchAll(/^monitor_response_time\{[^}]*monitor_name="([^"]*)"[^}]*\}\s+(\S+)/gm)].map((m) => [m[1], Number(m[2])]));
    const label = ["Down", "Up", "Pending", "Maintenance"];
    const col = ["#ff453a", "#30d158", "#ff9f0a", "#64d2ff"];
    return <div>{ms.map((m) => (
      <div key={m.name} style={row}><span><span style={{ color: col[m.v] ?? "#999" }}>●</span> {m.name}</span>
        <span style={{ color: "#9aa4b2" }}>{label[m.v] ?? m.v}{rt.get(m.name) ? ` · ${rt.get(m.name)} ms` : ""}</span></div>))}</div>;
  }}</Loaded></div>;
}

function N8n({ n }: { n: number }) {
  const [tab, setTab] = useState<"workflows" | "executions">("workflows");
  const [note, setNote] = useState("");
  const s = useLoad(() => door.app<any>("n8n", `/n8n-ro/api/v1/${tab}?limit=100`), `${tab}${n}`);
  const activate = async (w: any) => {
    setNote("");
    try {
      const r = await door.post<any>("/app/approvals/v1/approvals", { action: { type: "n8n_activate", workflowId: String(w.id) }, requester: { app: "NODE", via: "door" }, reason: `Activate n8n workflow "${w.name}" from NODE` });
      setNote(`Approval requested (${r.id}). It runs after you approve it on your phone.`);
    } catch (e) { setNote("Couldn't request approval: " + (e as Error).message); }
  };
  return (
    <div style={box}>
      <Tabs tabs={["workflows", "executions"]} tab={tab} set={setTab} />
      {note && <Msg>{note}</Msg>}
      <Loaded s={s}>{(d) => {
        const items: any[] = d?.data ?? [];
        if (!items.length) return <Msg>No {tab} in n8n yet.</Msg>;
        return <div>{items.map((x) => tab === "workflows" ? (
          <div key={x.id} style={row}><span>{x.name}</span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ color: x.active ? "#30d158" : "#9aa4b2" }}>{x.active ? "Active" : "Off"}</span>
              {!x.active && <button type="button" onClick={() => void activate(x)} style={btn}>Activate…</button>}</span></div>
        ) : (
          <div key={x.id} style={row}><span>#{x.id} · workflow {x.workflowId}</span><span style={{ color: x.status === "success" ? "#30d158" : "#9aa4b2" }}>{x.status ?? (x.finished ? "finished" : "running")} · {x.startedAt?.slice(0, 16).replace("T", " ")}</span></div>
        ))}</div>;
      }}</Loaded>
    </div>
  );
}

const btn: React.CSSProperties = { padding: "4px 10px", borderRadius: 12, border: 0, background: "#0a84ff", color: "#fff" };
function Tabs<T extends string>({ tabs, tab, set }: { tabs: T[]; tab: T; set: (t: T) => void }) {
  return <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>{tabs.map((t) => (
    <button key={t} type="button" onClick={() => set(t)} style={{ padding: "6px 12px", borderRadius: 16, border: 0, background: t === tab ? "#0a84ff" : "#1d2532", color: "#fff", textTransform: "capitalize" }}>{t}</button>))}</div>;
}

function OpenClaw({ n }: { n: number }) {
  const [key, setKey] = useState<string | null>(null);
  const call = (tool: string, args: object) => door.post<any>("/app/openclaw/tools/invoke", { tool, args }).then((r) => JSON.parse(r?.result?.content?.[0]?.text ?? "{}"));
  const s = useLoad(() => (key ? call("sessions_history", { sessionKey: key, limit: 50 }) : call("sessions_list", { limit: 50 })), `${key}${n}`);
  const text = (c: any): string => typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p.type === "text" ? p.text : p.type === "toolCall" ? `[${p.name}]` : "").filter(Boolean).join("\n") : "";
  return (
    <div style={box}>
      {key && <button type="button" onClick={() => setKey(null)} style={{ marginBottom: 8, background: "none", border: 0, color: "#0a84ff" }}>‹ All conversations</button>}
      <Loaded s={s}>{(d) => key ? (
        <div style={{ display: "grid", gap: 8 }}>{(d.messages ?? []).map((m: any, i: number) => {
          const t = text(m.content); if (!t) return null;
          const me = m.role === "user";
          return <div key={i} style={{ justifySelf: me ? "end" : "start", maxWidth: "85%", background: me ? "#0a84ff" : "#1d2532", padding: "8px 12px", borderRadius: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{t}</div>;
        })}<Msg>Sending to OpenClaw from NODE needs an approval-gateway action (proposal filed); use NODE's chat meanwhile.</Msg></div>
      ) : (
        <div>{(d.sessions ?? []).map((x: any) => (
          <button type="button" key={x.key} onClick={() => setKey(x.key)} style={{ ...row, width: "100%", background: "none", color: "inherit", border: 0, borderBottom: "1px solid #1d2532", textAlign: "left" }}>
            <span>{x.label ?? x.displayName}</span><span style={{ color: "#9aa4b2" }}>{x.kind} · {x.updatedAt ? new Date(x.updatedAt).toLocaleString() : ""}</span></button>))}</div>
      )}</Loaded>
    </div>
  );
}

function OpenJarvis({ n }: { n: number }) {
  const [tab, setTab] = useState<"overview" | "agents" | "models" | "approvals" | "skills">("overview");
  const path = { overview: "/v1/info", agents: "/v1/agents", models: "/v1/models", approvals: "/v1/approvals/pending", skills: "/v1/skills" }[tab];
  const s = useLoad(() => door.app<any>("openjarvis", path), `${tab}${n}`);
  return (
    <div style={box}>
      <Tabs tabs={["overview", "agents", "models", "approvals", "skills"]} tab={tab} set={setTab} />
      <Loaded s={s}>{(d) => {
        const list: any[] = tab === "agents" ? d.registered ?? [] : tab === "models" ? d.data ?? [] : tab === "approvals" ? d.actions ?? [] : tab === "skills" ? (Array.isArray(d) ? d : d.skills ?? []) : [];
        if (tab === "overview") return <div>{Object.entries(d ?? {}).map(([k, v]) => <div key={k} style={row}><span>{k}</span><span style={{ color: "#9aa4b2" }}>{String(v)}</span></div>)}</div>;
        if (!list.length) return <Msg>Nothing here.</Msg>;
        return <div>{list.map((x, i) => <div key={i} style={row}><span>{x.key ?? x.id ?? x.name ?? JSON.stringify(x).slice(0, 60)}</span><span style={{ color: "#9aa4b2" }}>{x.class ?? x.owned_by ?? x.description ?? x.status ?? ""}</span></div>)}</div>;
      }}</Loaded>
    </div>
  );
}

function Paperclip({ n }: { n: number }) {
  const [tab, setTab] = useState<"issues" | "agents">("issues");
  const co = useLoad(() => door.app<any[]>("paperclip", "/api/companies"), n);
  const cid = co.d?.[0]?.id as string | undefined;
  const s = useLoad(() => (cid ? door.app<any[]>("paperclip", `/api/companies/${cid}/${tab}`) : new Promise<any[]>(() => {})), `${cid}${tab}${n}`);
  return (
    <div style={box}>
      <div style={{ color: "#9aa4b2", marginBottom: 8 }}>{co.d?.[0]?.name ?? ""}</div>
      <Tabs tabs={["issues", "agents"]} tab={tab} set={setTab} />
      <Loaded s={co.e ? co : s}>{(d: any) => {
        const items: any[] = Array.isArray(d) ? d : [];
        if (!items.length) return <Msg>No {tab}.</Msg>;
        return <div>{items.map((x) => tab === "issues" ? (
          <div key={x.id} style={row}><span>{x.identifier} {x.title}</span><span style={{ color: x.status === "done" ? "#30d158" : "#ff9f0a" }}>{x.status}</span></div>
        ) : (
          <div key={x.id} style={row}><span>{x.name}</span><span style={{ color: "#9aa4b2" }}>{x.role} · {x.status}</span></div>
        ))}</div>;
      }}</Loaded>
    </div>
  );
}

function Searx() {
  const [q, setQ] = useState("");
  const [run, setRun] = useState("");
  const s = useLoad(() => (run ? door.app<any>("searxng", `/search?format=json&q=${encodeURIComponent(run)}`) : Promise.resolve({ results: [] })), run);
  return (
    <div style={box}>
      <form onSubmit={(e) => { e.preventDefault(); setRun(q.trim()); }} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search privately" aria-label="Search" style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid #2a3442", background: "#111722", color: "#e6e9ef", fontSize: 16 }} />
        <button style={btn}>Search</button>
      </form>
      <Loaded s={s}>{(d) => <div>{(d.results ?? []).map((r: any, i: number) => (
        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "10px 4px", borderBottom: "1px solid #1d2532", color: "inherit", textDecoration: "none" }}>
          <div style={{ color: "#64d2ff" }}>{r.title}</div><div style={{ color: "#9aa4b2", fontSize: 13 }}>{r.url}</div><div style={{ fontSize: 14 }}>{r.content}</div></a>))}</div>}</Loaded>
    </div>
  );
}

function LlamaSwap({ n }: { n: number }) {
  const m = useLoad(() => door.app<any>("llama-swap", "/v1/models"), n);
  const r = useLoad(() => door.app<any>("llama-swap", "/running"), n);
  const running = new Set<string>((r.d?.running ?? []).map((x: any) => x.model ?? x.name));
  return <div style={box}><Loaded s={m}>{(d) => <div>{(d.data ?? []).map((x: any) => (
    <div key={x.id} style={row}><span>{x.id}</span><span style={{ color: running.has(x.id) ? "#30d158" : "#9aa4b2" }}>{running.has(x.id) ? "loaded" : x.status?.value ?? "unloaded"}</span></div>))}</div>}</Loaded></div>;
}

const MCP_PUBLIC = "https://steve-ms-7c02.tail1af4f2.ts.net:10000/mcp";
async function mcpTools(): Promise<{ server: string; tools: { name: string; description?: string }[] }> {
  const h = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  const parse = async (r: Response) => { const t = await r.text(); const m = /\{[\s\S]*\}/.exec(t); if (!r.ok || !m) throw new Error(`MCP ${r.status}`); return JSON.parse(m[0]); };
  const i = await fetch(`${DOOR_BASE}/mcp`, { method: "POST", credentials: "include", headers: h, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "NODE", version: "1" } } }) });
  const sid = i.headers.get("mcp-session-id") ?? ""; const init = await parse(i);
  const hs = { ...h, ...(sid ? { "mcp-session-id": sid } : {}) };
  await fetch(`${DOOR_BASE}/mcp`, { method: "POST", credentials: "include", headers: hs, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
  const l = await parse(await fetch(`${DOOR_BASE}/mcp`, { method: "POST", credentials: "include", headers: hs, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) }));
  return { server: `${init.result?.serverInfo?.name ?? "MCP"} ${init.result?.serverInfo?.version ?? ""}`, tools: l.result?.tools ?? [] };
}

function Mcp({ n }: { n: number }) {
  const [k, setK] = useState(0);
  const st = useLoad(mcpTools, n);
  const toks = useLoad(() => fetch(`${DOOR_BASE}/mcp-tokens`, { credentials: "include" }).then((r) => r.json() as Promise<any[]>), `${n}${k}`);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<{ label: string; token: string } | null>(null);
  const create = async () => { const r = await door.post<any>("/mcp-tokens", { label: label || "MCP client" }); setFresh({ label: r.label, token: r.token }); setLabel(""); setK((x) => x + 1); };
  const revoke = async (id: string) => { await fetch(`${DOOR_BASE}/mcp-tokens/${id}`, { method: "DELETE", credentials: "include" }); setK((x) => x + 1); };
  return (
    <div style={box}>
      <div style={row}><span>Endpoint</span><code style={{ color: "#64d2ff", wordBreak: "break-all" }}>{MCP_PUBLIC}</code></div>
      <div style={row}><span>Status</span><span style={{ color: st.e ? "#ff453a" : st.d ? "#30d158" : "#9aa4b2" }}>{st.e ? `Down (${st.e})` : st.d ? `Up · ${st.d.server}` : "Checking…"}</span></div>
      <div style={{ ...row, color: "#9aa4b2", fontSize: 13 }}>Changes made through MCP go to the approval gateway first.</div>
      <h3 style={{ margin: "16px 0 4px" }}>Tools</h3>
      <Loaded s={st}>{(d) => <div>{d.tools.map((t) => <div key={t.name} style={{ ...row, flexDirection: "column", gap: 2 }}><b>{t.name}</b><span style={{ color: "#9aa4b2", fontSize: 13 }}>{(t.description ?? "").slice(0, 200)}</span></div>)}</div>}</Loaded>
      <h3 style={{ margin: "16px 0 4px" }}>Access tokens</h3>
      <form onSubmit={(e) => { e.preventDefault(); void create(); }} style={{ display: "flex", gap: 8, margin: "8px 0" }}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Client name (e.g. Claude on laptop)" aria-label="Client name" style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #2a3442", background: "#111722", color: "#e6e9ef", fontSize: 16 }} />
        <button style={btn}>New token</button>
      </form>
      {fresh && <div role="status" data-testid="mcp-fresh" style={{ background: "#1d2532", padding: 12, borderRadius: 12, margin: "8px 0" }}>
        <div>Token for <b>{fresh.label}</b>. It is shown only this once.</div>
        <code style={{ display: "block", wordBreak: "break-all", margin: "8px 0", color: "#ffd60a" }}>{fresh.token}</code>
        <div style={{ display: "flex", gap: 8 }}><button type="button" style={btn} onClick={() => void navigator.clipboard?.writeText(fresh.token)}>Copy</button><button type="button" style={{ ...btn, background: "#3a3a3c" }} onClick={() => setFresh(null)}>Done</button></div>
        <div style={{ color: "#9aa4b2", fontSize: 13, marginTop: 6 }}>Use it as <code>Authorization: Bearer …</code> with {MCP_PUBLIC}</div>
      </div>}
      <Loaded s={toks}>{(d) => !d.length ? <Msg>No client tokens yet.</Msg> : <div>{d.map((t) => (
        <div key={t.id} style={row}><span>{t.label} <span style={{ color: "#9aa4b2", fontSize: 13 }}>· {new Date(t.created * 1000).toLocaleDateString()}</span></span>
          <button type="button" style={{ ...btn, background: "#ff453a" }} onClick={() => void revoke(t.id)}>Revoke</button></div>))}</div>}</Loaded>
    </div>
  );
}

function MiniDlna({ n }: { n: number }) {
  const s = useLoad(() => door.appText("minidlna", "/").then((t) => ({ up: true, t })).catch(() => ({ up: false, t: "" })), n);
  return <div style={box}><Loaded s={s}>{(d) => d.up
    ? <div>{d.t.replace(/<[^>]+>/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => <div key={i} style={row}>{l}</div>)}</div>
    : <div style={row}><span><span style={{ color: "#ff453a" }}>●</span> MiniDLNA</span><span style={{ color: "#9aa4b2" }}>Stopped</span></div>}</Loaded></div>;
}

function Health({ name, paths, n }: { name: string; paths: string[]; n: number }) {
  const s = useLoad(() => Promise.all(paths.map((p) => door.appText(name, p).then((t) => ({ p, t, ok: true })).catch((e: Error) => ({ p, t: e.message, ok: false })))), n);
  return <div style={box}><Loaded s={s}>{(rs) => <div>{rs.map((r) => (
    <div key={r.p} style={{ ...row, flexDirection: "column" }}><span><span style={{ color: r.ok ? "#30d158" : "#ff453a" }}>●</span> {r.p}</span>
      <code style={{ color: "#9aa4b2", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13 }}>{r.t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600)}</code></div>))}</div>}</Loaded></div>;
}

export function NativeApp({ slug, n }: { slug: string; n: number }) {
  switch (slug) {
    case "twenty-crm": return <Twenty n={n} />;
    case "navidrome": return <Navidrome n={n} />;
    case "uptime-kuma": return <Kuma n={n} />;
    case "n8n": return <N8n n={n} />;
    case "litellm": return <Health name="litellm" paths={["/health/readiness", "/health/liveliness"]} n={n} />;
    case "crawl4ai": return <Health name="crawl4ai" paths={["/health"]} n={n} />;
    case "minidlna": return <MiniDlna n={n} />;
    case "openjarvis": return <OpenJarvis n={n} />;
    case "paperclip": return <Paperclip n={n} />;
    case "searxng": return <Searx />;
    case "llama-swap": return <LlamaSwap n={n} />;
    case "openclaw": return <OpenClaw n={n} />;
    case "mcp": return <Mcp n={n} />;
    default: return <Msg>No NODE view for {slug}.</Msg>;
  }
}
