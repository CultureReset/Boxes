import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Folder, LayoutGrid, Settings, ArrowRight, FileText } from "lucide-react";
import { api, useApi } from "../api/client";
import type { AppEntry, FileEntry } from "../api/types";
import { AppIcon } from "./AppIcon";
import { navigate } from "../lib/router";
import { useToast } from "../state/toast";
import { SETTINGS_INDEX } from "../screens/settings/index";

interface Hit {
  kind: "app" | "file" | "setting" | "action";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  run: () => void;
}

/** Spotlight-style search across apps, files, settings and quick actions. */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [sel, setSel] = useState(0);
  const { data: apps } = useApi<AppEntry[]>("/api/apps");
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    if (q.trim().length < 2) {
      setFiles([]);
      return;
    }
    const t = setTimeout(() => api.get<FileEntry[]>(`/api/files/search?q=${encodeURIComponent(q.trim())}`).then(setFiles).catch(() => setFiles([])), 200);
    return () => clearTimeout(t);
  }, [q]);

  const hits = useMemo<Hit[]>(() => {
    const needle = q.trim().toLowerCase();
    const out: Hit[] = [];
    if (needle) {
      for (const a of (apps ?? []).filter((a) => a.name.toLowerCase().includes(needle) || a.comment.toLowerCase().includes(needle)).slice(0, 6)) {
        out.push({ kind: "app", title: a.name, subtitle: a.comment || "App", icon: <AppIcon icon={a.icon} name={a.name} color={a.color} size="sm" />, run: () => void api.post<{ message: string }>("/api/apps/launch", { id: a.id }).then((r) => toast(r.message)) });
      }
      for (const s of SETTINGS_INDEX.filter((s) => s.title.toLowerCase().includes(needle) || s.keywords.some((k) => k.includes(needle))).slice(0, 4)) {
        out.push({ kind: "setting", title: s.title, subtitle: "Settings", icon: <span className="app-icon sm" style={{ ["--ic" as string]: "#636e7b" }}><Settings size={18} /></span>, run: () => navigate("settings", s.id) });
      }
      for (const f of files.slice(0, 6)) {
        out.push({ kind: "file", title: f.name, subtitle: f.path, icon: <span className="app-icon sm" style={{ ["--ic" as string]: f.kind === "folder" ? "#0a84ff" : "#8e8e93" }}>{f.kind === "folder" ? <Folder size={18} /> : <FileText size={18} />}</span>, run: () => (f.kind === "folder" ? navigate("files", undefined, { path: f.path }) : void api.post("/api/open", { target: f.path })) });
      }
    } else {
      out.push({ kind: "action", title: "Open Apps", subtitle: "Everything you can open", icon: <span className="app-icon sm" style={{ ["--ic" as string]: "#0a84ff" }}><LayoutGrid size={18} /></span>, run: () => navigate("apps") });
      out.push({ kind: "action", title: "Browse Files", subtitle: "Your documents", icon: <span className="app-icon sm" style={{ ["--ic" as string]: "#30d158" }}><Folder size={18} /></span>, run: () => navigate("files") });
      out.push({ kind: "action", title: "Settings", subtitle: "Wi‑Fi, sound, display and more", icon: <span className="app-icon sm" style={{ ["--ic" as string]: "#636e7b" }}><Settings size={18} /></span>, run: () => navigate("settings") });
    }
    return out;
  }, [q, apps, files, toast]);

  useEffect(() => setSel(0), [hits.length, q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setSel((s) => Math.min(hits.length - 1, s + 1));
    else if (e.key === "ArrowUp") setSel((s) => Math.max(0, s - 1));
    else if (e.key === "Enter" && hits[sel]) {
      hits[sel].run();
      onClose();
    } else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  return (
    <div className="backdrop" style={{ alignItems: "start", paddingTop: "12vh" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" style={{ width: "min(100%, 640px)" }} onKeyDown={onKey}>
        <div className="search" style={{ height: 58, border: 0, borderBottom: "1px solid var(--line)", borderRadius: 0, background: "transparent", padding: "0 20px" }}>
          <Search size={20} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps, files, settings…" style={{ fontSize: 17 }} />
        </div>
        <div style={{ padding: 8, maxHeight: "60vh", overflowY: "auto" }}>
          {hits.length === 0 && <div className="empty" style={{ border: 0 }}>Nothing found</div>}
          {hits.map((h, i) => (
            <button
              key={h.kind + h.title + i}
              type="button"
              className="list-row"
              style={{ borderRadius: 12, border: 0, background: i === sel ? "var(--glass-strong)" : undefined }}
              onMouseEnter={() => setSel(i)}
              onClick={() => {
                h.run();
                onClose();
              }}
            >
              {h.icon}
              <span className="stack grow">
                <span className="t truncate">{h.title}</span>
                <span className="s truncate">{h.subtitle}</span>
              </span>
              <ArrowRight size={16} style={{ color: "var(--text-3)" }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
