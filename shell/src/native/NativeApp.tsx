import { useEffect, useState, type ReactNode } from "react";
import { door } from "../lib/door";

/** NODE-native screens for apps whose own UI can't be shown signed-in inside
 *  NODE (frame-blocking headers / their own login). Data comes from each app's
 *  API through the door (/door/app/<name>/...), credentials injected on the PC. */
export const NATIVE: Record<string, { door: string; open?: string }> = {
  "twenty-crm": { door: "twenty" },
  navidrome: { door: "navidrome" },
  "uptime-kuma": { door: "uptime-kuma" },
  n8n: { door: "n8n" },
  litellm: { door: "litellm" },
  crawl4ai: { door: "crawl4ai" },
  openclaw: { door: "" },
  minidlna: { door: "minidlna" },
};

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
  const s = useLoad(() => door.app<any>("n8n", "/api/v1/workflows?limit=100"), n);
  if (s.e && /no n8n credentials/.test(s.e)) return <div style={box}><Msg>n8n isn't connected to NODE yet. A proposal to link it is on the PC (node-door PROPOSALS.md); nothing for you to do here.</Msg></div>;
  return <div style={box}><Loaded s={s}>{(d) => <div>{(d?.data ?? []).map((w: any) => (
    <div key={w.id} style={row}><span>{w.name}</span><span style={{ color: w.active ? "#30d158" : "#9aa4b2" }}>{w.active ? "Active" : "Off"}</span></div>))}</div>}</Loaded></div>;
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
    case "minidlna": return <Health name="minidlna" paths={["/"]} n={n} />;
    case "openclaw": return <div style={box}><Msg>OpenClaw's control UI refuses to be shown inside other pages and has no read API the door can use yet. A proposal is on the PC (node-door PROPOSALS.md); until then use it from Paperclip, which is shown here.</Msg></div>;
    default: return <Msg>No NODE view for {slug}.</Msg>;
  }
}
