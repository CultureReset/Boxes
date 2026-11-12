import { useEffect, useMemo, useState } from "react";
import { Folder, FileText, Image as ImageIcon, Film, Music, FileSpreadsheet, Presentation, Code2, Archive, AppWindow, File, Search, Plus, Home, Download, Clock, Trash2, Pencil, ExternalLink, HardDrive, ChevronRight, Eye, LayoutGrid, List, Lock, Layers } from "lucide-react";
import { api, useApi } from "../api/client";
import type { FileEntry, FileKind, FileSource } from "../api/types";
import { Hero } from "../components/Hero";
import { Sheet } from "../components/Sheet";
import { useMenu } from "../components/Menu";
import { Empty, Skeleton, Segment } from "../components/ui";
import { useToast } from "../state/toast";
import { navigate } from "../lib/router";
import { bytes, timeAgo } from "../lib/format";

const GLYPH: Record<FileKind, { Icon: typeof Folder; color: string }> = {
  folder: { Icon: Folder, color: "#0a84ff" },
  image: { Icon: ImageIcon, color: "#ff2d55" },
  video: { Icon: Film, color: "#bf5af2" },
  audio: { Icon: Music, color: "#ff375f" },
  pdf: { Icon: FileText, color: "#ff453a" },
  document: { Icon: FileText, color: "#2b7de9" },
  spreadsheet: { Icon: FileSpreadsheet, color: "#30d158" },
  presentation: { Icon: Presentation, color: "#ff9f0a" },
  text: { Icon: FileText, color: "#8e8e93" },
  code: { Icon: Code2, color: "#5e5ce6" },
  archive: { Icon: Archive, color: "#ac8e68" },
  app: { Icon: AppWindow, color: "#64d2ff" },
  other: { Icon: File, color: "#636e7b" },
};

export function FileGlyph({ kind, size = "md" }: { kind: FileKind; size?: "sm" | "md" | "lg" }) {
  const { Icon, color } = GLYPH[kind] ?? GLYPH.other;
  const px = size === "sm" ? 20 : size === "lg" ? 34 : 26;
  return <span className={`app-icon ${size}`} style={{ ["--ic" as string]: color }}><Icon size={px} /></span>;
}

const QUICK = [
  { label: "Home", path: "~", Icon: Home },
  { label: "Documents", path: "~/Documents", Icon: FileText },
  { label: "Downloads", path: "~/Downloads", Icon: Download },
  { label: "Pictures", path: "~/Pictures", Icon: ImageIcon },
  { label: "Music", path: "~/Music", Icon: Music },
  { label: "Videos", path: "~/Videos", Icon: Film },
];

const SOURCE_ICON: Record<FileSource["id"], typeof Folder> = { ssd: HardDrive, spinning: Archive, scrap: Layers, images: ImageIcon, documents: FileText };

/** `source:<id>` shows one named source's folders instead of a directory listing. */
const sourceOf = (p: string) => (p.startsWith("source:") ? p.slice(7) : null);

export function Files({ path }: { path: string }) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [results, setResults] = useState<FileEntry[] | null>(null);
  const [preview, setPreview] = useState<FileEntry | null>(null);
  const [renaming, setRenaming] = useState<FileEntry | null>(null);
  const [newFolder, setNewFolder] = useState(false);
  const sourceId = sourceOf(path);
  const special = path === "recent" || sourceId !== null;
  const { data, error, loading, reload } = useApi<{ path: string; entries: FileEntry[]; readOnly?: boolean }>(special ? null : `/api/files?path=${encodeURIComponent(path)}`, [], [path]);
  const { data: sources } = useApi<FileSource[]>("/api/files/sources");
  const source = sourceId ? sources?.find((s) => s.id === sourceId) ?? null : null;
  const readOnly = Boolean(data?.readOnly) || Boolean(source?.readOnly);
  const { data: recent } = useApi<FileEntry[]>(path === "recent" ? "/api/files/recent" : null);
  const { data: disk } = useApi<{ total: number; used: number } | null>("/api/files/disk");
  const toast = useToast();
  const menu = useMenu();

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    const scope = sourceId ? `&source=${encodeURIComponent(sourceId)}` : "";
    const t = setTimeout(() => api.get<FileEntry[]>(`/api/files/search?q=${encodeURIComponent(q.trim())}${scope}`).then(setResults), 250);
    return () => clearTimeout(t);
  }, [q, sourceId]);

  const crumbs = useMemo(() => {
    const shown = data?.path ?? path;
    // Absolute paths (the spinning drive at /hdd, mounted media) get their own root crumb instead of "Home".
    if (shown.startsWith("/")) {
      const parts = shown.split("/").filter(Boolean);
      return parts.map((p, i) => ({ label: i === 0 ? "/" + p : p, path: "/" + parts.slice(0, i + 1).join("/") }));
    }
    const parts = shown.replace(/^~\/?/, "").split("/").filter(Boolean);
    return [{ label: "Home", path: "~" }, ...parts.map((p, i) => ({ label: p, path: "~/" + parts.slice(0, i + 1).join("/") }))];
  }, [data?.path, path]);

  const open = (f: FileEntry) => {
    if (f.kind === "folder") navigate("files", undefined, { path: f.path });
    else if (["image", "text", "code", "pdf", "video", "audio"].includes(f.kind)) setPreview(f);
    else void api.post("/api/open", { target: f.path }).then(() => toast(`Opening ${f.name}`));
  };
  const openWith = (f: FileEntry) => void api.post("/api/open", { target: f.path }).then(() => toast(`Opening ${f.name}`));
  const trash = (f: FileEntry) => void api.post<{ ok: boolean; message: string }>("/api/files/trash", { path: f.path }).then((r) => { toast(r.message, r.ok ? "ok" : "error"); reload(); });
  const items = results ?? (path === "recent" ? recent ?? [] : sourceId ? [] : data?.entries ?? []);

  return (
    <>
      <Hero title="Files" subtitle="Your documents, photos and downloads." tagline={disk ? `${bytes(disk.total - disk.used)} free of ${bytes(disk.total)}` : null} />
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your files…" />
        </label>
        <Segment value={view} onChange={setView} options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]} />
        <span className="spacer" />
        {readOnly ? <span className="dim small row" style={{ gap: 6 }}><Lock size={14} /> Read-only archive</span> : !special && <button type="button" className="btn" onClick={() => setNewFolder(true)}><Plus size={15} /> New folder</button>}
      </div>

      <div className="hscroll" style={{ marginBottom: 18 }}>
        {[...QUICK, { label: "Recent", path: "recent", Icon: Clock }].map((qk) => (
          <button key={qk.path} type="button" className={`btn pillbtn${path === qk.path ? " primary" : ""}`} onClick={() => { setQ(""); navigate("files", undefined, { path: qk.path }); }}>
            <qk.Icon size={15} /> {qk.label}
          </button>
        ))}
      </div>

      {sources && sources.some((s) => s.folders.length > 0) && (
        <div className="hscroll" style={{ marginBottom: 18 }}>
          {sources.filter((s) => s.folders.length > 0).map((s) => {
            const Icon = SOURCE_ICON[s.id] ?? Folder;
            return (
              <button key={s.id} type="button" title={s.hint} className={`btn pillbtn${sourceId === s.id ? " primary" : ""}`} onClick={() => { setQ(""); navigate("files", undefined, { path: `source:${s.id}` }); }}>
                <Icon size={15} /> {s.label}{s.readOnly && <Lock size={12} className="dim" />}
              </button>
            );
          })}
        </div>
      )}

      {!results && source && (
        <>
          <div className="dim small" style={{ marginBottom: 14 }}>{source.hint}</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", marginBottom: 18 }}>
            {source.folders.map((f) => (
              <button key={f.path} type="button" className="card" style={{ padding: 16, display: "flex", gap: 12, alignItems: "center", textAlign: "left" }} onClick={() => navigate("files", undefined, { path: f.path })}>
                <FileGlyph kind="folder" />
                <span className="stack" style={{ minWidth: 0 }}>
                  <span className="truncate" style={{ fontWeight: 500 }}>{f.label}</span>
                  <span className="tiny muted truncate">{f.readOnly ? "Read-only · " : ""}{f.path}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {!results && !special && (
        <div className="row" style={{ marginBottom: 14, color: "var(--text-2)", flexWrap: "wrap", gap: 4 }}>
          {crumbs.map((c, i) => (
            <span key={c.path} className="row" style={{ gap: 4 }}>
              {i > 0 && <ChevronRight size={14} style={{ color: "var(--text-4)" }} />}
              <button type="button" className="btn ghost sm" style={{ fontWeight: i === crumbs.length - 1 ? 600 : 500, color: i === crumbs.length - 1 ? "var(--text)" : undefined }} onClick={() => navigate("files", undefined, { path: c.path })}>{c.label}</button>
            </span>
          ))}
        </div>
      )}

      {loading && !data && <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} h={140} />)}</div>}
      {error && <Empty icon={<Folder size={28} />} title="Can't open this folder" hint={error} />}
      {!loading && items.length === 0 && !error && !(source && !results) && <Empty icon={<Folder size={28} />} title={results ? "No matches" : "This folder is empty"} />}

      {view === "grid" ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {items.map((f) => (
            <button key={f.path} type="button" className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start", minHeight: 140 }} onClick={() => open(f)} onContextMenu={(e) => menu.open(e, fileMenu(f))}>
              {f.kind === "image" ? <img src={`/api/files/raw?path=${encodeURIComponent(f.path)}`} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 10, background: "var(--glass)" }} loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} /> : <FileGlyph kind={f.kind} size="lg" />}
              <span className="stack" style={{ width: "100%" }}>
                <span className="truncate" style={{ fontWeight: 500 }}>{f.name}</span>
                <span className="tiny muted">{f.kind === "folder" ? "Folder" : bytes(f.size)} · {timeAgo(f.modified)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="list">
          {items.map((f) => (
            <button key={f.path} type="button" className="list-row" onClick={() => open(f)} onContextMenu={(e) => menu.open(e, fileMenu(f))}>
              <FileGlyph kind={f.kind} size="sm" />
              <span className="stack grow"><span className="t truncate">{f.name}</span><span className="s truncate">{results ? f.path : timeAgo(f.modified)}</span></span>
              <span className="v">{f.kind === "folder" ? "" : bytes(f.size)}<ChevronRight size={16} /></span>
            </button>
          ))}
        </div>
      )}

      {disk && (
        <div className="card" style={{ marginTop: 24, padding: "14px 18px" }}>
          <div className="row" style={{ marginBottom: 8 }}><HardDrive size={16} className="dim" /><span style={{ fontWeight: 500 }}>Storage</span><span className="spacer" /><span className="dim small">{bytes(disk.used)} used of {bytes(disk.total)}</span></div>
          <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.1)" }}><div style={{ height: "100%", width: `${Math.min(100, (disk.used / disk.total) * 100)}%`, borderRadius: 3, background: "linear-gradient(90deg, var(--blue), var(--purple))" }} /></div>
        </div>
      )}

      {preview && <Preview f={preview} onClose={() => setPreview(null)} onOpen={() => openWith(preview)} />}
      {renaming && <NameSheet title="Rename" initial={renaming.name} onClose={() => setRenaming(null)} onSave={(name) => void api.post("/api/files/rename", { path: renaming.path, name }).then(() => { setRenaming(null); reload(); toast("Renamed"); }).catch((e) => toast(e.message, "error"))} />}
      {newFolder && <NameSheet title="New folder" initial="Untitled folder" onClose={() => setNewFolder(false)} onSave={(name) => void api.post("/api/files/folder", { parent: data?.path ?? path, name }).then(() => { setNewFolder(false); reload(); toast("Folder created"); }).catch((e) => toast(e.message, "error"))} />}
      {menu.element}
    </>
  );

  function fileMenu(f: FileEntry) {
    const view = [
      { label: "Open", icon: <Eye size={14} />, onClick: () => open(f) },
      { label: "Open with default app", icon: <ExternalLink size={14} />, onClick: () => openWith(f) },
    ];
    // Spinning drive / scrap archives are read-only; the daemon refuses changes there too.
    if (readOnly) return view;
    return [
      ...view,
      { label: "Rename", icon: <Pencil size={14} />, onClick: () => setRenaming(f) },
      { label: "", divider: true },
      { label: "Move to Trash", icon: <Trash2 size={14} />, danger: true, onClick: () => trash(f) },
    ];
  }
}

function NameSheet({ title, initial, onClose, onSave }: { title: string; initial: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initial);
  return (
    <Sheet title={title} onClose={onClose} size="narrow" footer={<><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="button" className="btn primary" disabled={!name.trim()} onClick={() => onSave(name.trim())}>Save</button></>}>
      <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} onKeyDown={(e) => e.key === "Enter" && name.trim() && onSave(name.trim())} />
    </Sheet>
  );
}

function Preview({ f, onClose, onOpen }: { f: FileEntry; onClose: () => void; onOpen: () => void }) {
  const raw = `/api/files/raw?path=${encodeURIComponent(f.path)}`;
  const { data: text } = useApi<{ text: string }>(f.kind === "text" || f.kind === "code" ? `/api/files/text?path=${encodeURIComponent(f.path)}` : null);
  return (
    <Sheet title={f.name} icon={<FileGlyph kind={f.kind} size="sm" />} onClose={onClose} size="wide" footer={<><span className="dim small" style={{ marginRight: "auto" }}>{bytes(f.size)} · {f.path}</span><button type="button" className="btn primary" onClick={onOpen}><ExternalLink size={15} /> Open in app</button></>}>
      {f.kind === "image" && <img src={raw} alt={f.name} style={{ maxHeight: "60vh", margin: "0 auto", borderRadius: 12, objectFit: "contain" }} />}
      {f.kind === "video" && <video src={raw} controls style={{ width: "100%", maxHeight: "60vh", borderRadius: 12 }} />}
      {f.kind === "audio" && <audio src={raw} controls style={{ width: "100%" }} />}
      {f.kind === "pdf" && <iframe src={raw} title={f.name} style={{ width: "100%", height: "60vh", border: 0, borderRadius: 12, background: "#fff" }} />}
      {(f.kind === "text" || f.kind === "code") && <pre className="job-out mono" style={{ maxHeight: "60vh", fontSize: 13 }}>{text?.text ?? "Loading…"}</pre>}
    </Sheet>
  );
}

export { LayoutGrid, List };
