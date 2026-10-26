import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown, Play, Trash2, Globe, Download, Check, LayoutGrid, Smartphone, Monitor, Plus, Usb } from "lucide-react";
import { api, useApi } from "../api/client";
import type { AndroidStatus, AppEntry, Job, Package, PackageResult, ProviderInfo, WebApp, WindowEntry } from "../api/types";
import { Unavailable, DemoBadge } from "../components/Unavailable";
import { Hero } from "../components/Hero";
import { Section } from "../components/Section";
import { ItemCard } from "../components/ItemCard";
import { AppIcon } from "../components/AppIcon";
import { Segment, Dot, Skeleton, Empty, Pill } from "../components/ui";
import { useMenu } from "../components/Menu";
import { useToast } from "../state/toast";
import { Sheet } from "../components/Sheet";
import { colorFor } from "../lib/format";
import { navigate } from "../lib/router";
import type { ScreenProps } from "../modules/registry";

type Filter = "all" | "linux" | "web" | "android" | "store";

const CATEGORY_LABELS: [RegExp, string][] = [
  [/Network|WebBrowser|Email|Chat|InstantMessaging/, "Internet & Social"],
  [/AudioVideo|Audio|Video|Music|Player/, "Music & Video"],
  [/Graphics|Photography|2DGraphics|RasterGraphics/, "Photos & Design"],
  [/Office|WordProcessor|Spreadsheet|Presentation|TextEditor|Calendar/, "Work"],
  [/Development|IDE/, "Developer"],
  [/Game/, "Games"],
  [/Utility|System|Settings/, "Utilities"],
];

function categoryOf(a: AppEntry): string {
  for (const [re, label] of CATEGORY_LABELS) if (a.categories.some((c) => re.test(c))) return label;
  return "Other";
}

/**
 * Apps is provider-agnostic: it asks the daemon for tiles and groups them by
 * the provider that produced them. A new provider shows up as a new group
 * with no changes here.
 */
export function Apps({ onJob, params }: ScreenProps) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) || "all");
  const [sort, setSort] = useState<"name" | "category">("name");
  const [storeQ, setStoreQ] = useState("");
  const [webSheet, setWebSheet] = useState(params.get("add") === "1");
  const { data: apps, reload } = useApi<AppEntry[]>("/api/apps", ["apps", "android", "job"]);
  const { data: providers } = useApi<ProviderInfo[]>("/api/apps/providers", ["android"]);
  const { data: android } = useApi<AndroidStatus>("/api/android", ["android"]);
  const { data: windows } = useApi<WindowEntry[]>("/api/windows", ["windows"]);
  const { data: store } = useApi<PackageResult>(filter === "store" || q ? `/api/store/search?q=${encodeURIComponent((filter === "store" ? storeQ : q).trim())}` : null, ["job"], [storeQ, q, filter]);
  const packages = store?.packages;
  const toast = useToast();
  const menu = useMenu();
  useEffect(() => {
    const f = params.get("filter") as Filter | null;
    if (f) setFilter(f);
    if (params.get("add") === "1") setWebSheet(true);
  }, [params]);

  const launch = (a: AppEntry) => void api.post<{ ok: boolean; message: string }>("/api/apps/launch", { id: a.id }).then((r) => toast(r.message, r.ok ? "ok" : "error")).catch((e) => toast(e.message, "error"));
  const install = (p: Package) => void api.post<Job>("/api/store/install", { name: p.name, appId: p.appId, source: p.source }).then((j) => onJob(j.id)).catch((e) => toast(e.message, "error"));
  const remove = (a: AppEntry) => void api.post<{ ok: boolean; message: string; jobId?: string }>("/api/apps/remove", { id: a.id }).then((r) => { r.jobId ? onJob(r.jobId) : toast(r.message, r.ok ? "ok" : "error"); reload(); }).catch((e) => toast(e.message, "error"));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (apps ?? []).filter((a) => (filter === "all" || a.provider === filter) && (!needle || a.name.toLowerCase().includes(needle) || a.comment.toLowerCase().includes(needle)));
  }, [apps, q, filter]);

  const isOpen = (a: AppEntry) => windows?.some((w) => w.appId === a.id);
  const statusOf = (a: AppEntry) => (isOpen(a) ? "Open" : a.provider === "web" ? "Web app" : a.provider === "android" ? "On your phone" : a.source === "flatpak" ? "Flatpak" : "Installed");
  const card = (a: AppEntry) => (
    <ItemCard key={a.id} icon={a.package === "__screen" ? <span className="app-icon" style={{ ["--ic" as string]: "#3ddc84" }}><Smartphone size={26} /></span> : <AppIcon icon={a.icon} name={a.name} color={a.color} />} title={a.name} subtitle={a.comment || statusOf(a)} meta={<><Dot state={isOpen(a) ? "on" : a.provider === "web" ? "info" : "off"} /> {statusOf(a)}</>} onClick={() => launch(a)} onMore={(e) => menu.open(e, [{ label: "Open", icon: <Play size={14} />, onClick: () => launch(a) }, ...(a.provider === "android" ? [] : [{ divider: true, label: "" }, { label: a.provider === "web" ? "Remove from NODE" : "Uninstall", icon: <Trash2 size={14} />, danger: true, onClick: () => remove(a) }])])} />
  );

  const groups = useMemo(() => {
    const out: [string, AppEntry[]][] = [];
    const byProvider = (id: string) => filtered.filter((a) => a.provider === id);
    if (filter === "all") {
      if (sort === "category") {
        const m = new Map<string, AppEntry[]>();
        for (const a of byProvider("linux")) m.set(categoryOf(a), [...(m.get(categoryOf(a)) ?? []), a]);
        for (const [k, v] of [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))) out.push([k, v]);
      } else if (byProvider("linux").length) out.push(["My Apps", byProvider("linux")]);
      if (byProvider("web").length) out.push(["Web Apps", byProvider("web")]);
      if (byProvider("android").length) out.push([android?.devices.find((d) => d.state === "device")?.model ?? "Your Phone", byProvider("android")]);
    } else if (filter !== "store") {
      out.push([filter === "linux" ? "My Apps" : filter === "web" ? "Web Apps" : android?.devices.find((d) => d.state === "device")?.model ?? "Your Phone", filtered]);
    }
    return out;
  }, [filtered, filter, sort, android]);

  const phone = android?.devices[0];
  const segments: { value: Filter; label: string }[] = [
    { value: "all", label: "All Apps" },
    { value: "linux", label: "Installed" },
    { value: "web", label: "Web Apps" },
    ...(android?.available ? [{ value: "android" as Filter, label: "Phone" }] : []),
    { value: "store", label: "App Store" },
  ];

  return (
    <>
      <Hero title="Apps" subtitle="Everything you can open, all in one place." />
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input value={filter === "store" ? storeQ : q} onChange={(e) => (filter === "store" ? setStoreQ(e.target.value) : setQ(e.target.value))} placeholder={filter === "store" ? "Search the App Store…" : "Search apps, tools, and more…"} />
        </label>
        <Segment value={filter} onChange={setFilter} options={segments} />
        <span className="spacer" />
        {filter === "all" && (
          <label className="select">
            Sort by:
            <select value={sort} onChange={(e) => setSort(e.target.value as "name" | "category")}>
              <option value="name">Name</option>
              <option value="category">Category</option>
            </select>
            <ChevronDown size={14} />
          </label>
        )}
        <button type="button" className="btn" onClick={() => setWebSheet(true)}>
          <Globe size={15} /> Add web app
        </button>
      </div>

      {filter === "android" && phone && phone.state !== "device" && <div className="card" style={{ padding: 18, marginBottom: 18 }}><div className="row"><Usb size={18} color="var(--orange)" /><span className="stack grow"><span style={{ fontWeight: 600 }}>{phone.model} is {phone.state}</span><span className="dim small">{phone.state === "unauthorized" ? "Unlock the phone and tap Allow on the USB debugging prompt." : "Check the cable and that USB debugging is on."}</span></span><button type="button" className="btn sm" onClick={() => navigate("settings", "devices")}>Phone settings</button></div></div>}
      {filter === "android" && android && android.devices.length === 0 && <Empty icon={<Smartphone size={28} />} title="No phone connected" hint="Plug in an Android phone with USB debugging on and its apps appear here." />}

      {filter !== "store" && (
        <>
          {apps === null && <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} />)}</div>}
          {apps && filtered.length === 0 && filter !== "android" && <Empty icon={<LayoutGrid size={28} />} title="No apps match" hint={filter === "web" ? "Add one with the button above." : "Try the App Store to add something new."} />}
          {groups.map(([label, list]) => (
            <Section key={label} title={label} grid>
              {list.map(card)}
            </Section>
          ))}
          {!q && filter === "all" && store?.status.available && packages && packages.length > 0 && (
            <Section title="App Store" link="Browse all" onLink={() => setFilter("store")}>
              {packages.slice(0, 8).map((p) => <StoreCard key={p.name} p={p} onInstall={install} />)}
            </Section>
          )}
          {filter === "all" && providers && (
            <Section title="App sources" grid>
              {providers.map((p) => <ItemCard key={p.id} icon={<span className="app-icon" style={{ ["--ic" as string]: p.ok ? "#30d158" : "#3a4250" }}>{p.id === "android" ? <Smartphone size={24} /> : p.id === "web" ? <Globe size={24} /> : <Monitor size={24} />}</span>} title={p.name} subtitle={p.description} meta={p.ok ? <Pill color="green" dot>Ready</Pill> : <Pill color="orange" dot>{p.reason ?? "Unavailable"}</Pill>} onClick={() => (p.id === "android" ? navigate("settings", "devices") : setFilter(p.id as Filter))} chevron />)}
            </Section>
          )}
        </>
      )}

      {filter === "store" && (
        <Section title={storeQ.trim() ? `Results for “${storeQ.trim()}”` : "Featured"} grid>
          {store === null && [1, 2, 3, 4].map((i) => <Skeleton key={i} />)}
          {store && !store.status.available && <Unavailable status={store.status} onJob={onJob} />}
          {store?.status.demo && <DemoBadge what="Sample catalog, not a real package list" />}
          {store?.status.available && packages && packages.length === 0 && <Empty icon={<Search size={28} />} title="Nothing found" hint="Try a different name." />}
          {store?.status.available && (packages ?? []).map((p) => <StoreCard key={p.name} p={p} onInstall={install} />)}
        </Section>
      )}

      {webSheet && <AddWebApp onClose={() => { setWebSheet(false); reload(); }} />}
      {menu.element}
    </>
  );
}

function StoreCard({ p, onInstall }: { p: Package; onInstall: (p: Package) => void }) {
  // Real artwork from the catalogue when it has some, a coloured initial otherwise.
  const icon = p.source === "flathub" && p.appId ? <span className="app-icon real" style={{ ["--ic" as string]: colorFor(p.name) }}><img src={`/api/store/icon/${encodeURIComponent(p.appId)}`} alt="" loading="lazy" onError={(e) => ((e.currentTarget.parentElement as HTMLElement).textContent = p.name.charAt(0).toUpperCase())} /></span> : <AppIcon name={p.name} color={colorFor(p.name)} />;
  const from = p.source === "flathub" ? `Flathub · ${p.version}` : `${p.repo || "Arch"} · ${p.version}`;
  return (
    <ItemCard icon={icon} title={p.name} subtitle={p.description || p.repo} meta={<><Dot state={p.installed ? "on" : "off"} /> {p.installed ? "Installed" : from}</>} action={p.installed ? <span className="pill green"><Check size={12} /> Installed</span> : <button type="button" className="btn sm pillbtn primary" onClick={() => onInstall(p)}><Download size={13} /> Get</button>} />
  );
}

/** Pick from the catalog (Toast, Facebook, Gmail…) or paste any address. */
function AddWebApp({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const { data: cat, reload } = useApi<WebApp[]>("/api/webapps/catalog");
  const toast = useToast();
  const add = async (input: { slug?: string; url?: string; name?: string }) => {
    try {
      const w = await api.post<WebApp>("/api/webapps/add", input);
      toast(`Added ${w.name}`);
      reload();
      if (input.url) onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add", "error");
    }
  };
  const needle = q.trim().toLowerCase();
  const list = (cat ?? []).filter((w) => !needle || w.name.toLowerCase().includes(needle) || w.category.toLowerCase().includes(needle));
  const groups = [...new Set(list.map((w) => w.category))];
  return (
    <Sheet title="Add a web app" icon={<Globe size={18} />} onClose={onClose} size="wide" footer={<button type="button" className="btn primary" onClick={onClose}>Done</button>}>
      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Any website</div>
        <p className="dim small" style={{ marginBottom: 12 }}>Runs like an app: no tabs, no address bar, its own window and tile.</p>
        <div className="form-row">
          <div className="field" style={{ marginBottom: 0 }}><label>Address</label><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="pos.toasttab.com" onKeyDown={(e) => e.key === "Enter" && url.trim() && void add({ url, name })} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Name (optional)</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Toast" /></div>
        </div>
        <button type="button" className="btn primary" style={{ marginTop: 12 }} disabled={!url.trim()} onClick={() => void add({ url, name })}><Plus size={15} /> Add</button>
      </div>
      <label className="search" style={{ marginBottom: 14 }}><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the catalog…" /></label>
      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 14 }}>
          <h4 className="dim small" style={{ margin: "0 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{g}</h4>
          <div className="list">
            {list.filter((w) => w.category === g).map((w) => (
              <div key={w.slug} className="list-row">
                <AppIcon name={w.name} color={w.color} size="sm" />
                <span className="stack grow"><span className="t">{w.name}</span><span className="s">{w.comment}</span></span>
                {w.added ? <button type="button" className="btn sm ghost" onClick={() => void api.post("/api/webapps/remove", { slug: w.slug }).then(reload)}><Check size={13} /> Added</button> : <button type="button" className="btn sm" onClick={() => void add({ slug: w.slug })}><Plus size={13} /> Add</button>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}
