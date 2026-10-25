import type { ReactNode } from "react";

/** Tiny, safe markdown: code fences, headings, lists, bold/italic/inline code, links. No HTML injection. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0], k = `${key}-${i++}`;
    if (t.startsWith("`")) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("**") || t.startsWith("__")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("[")) { const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)!; out.push(<a key={k} href={mm[2]} target="_blank" rel="noreferrer">{mm[1]}</a>); }
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0, n = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={n++}><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { blocks.push(<p key={n++} className="md-h">{inline(h[2], `h${n}`)}</p>); i++; continue; }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordered = /^\s*\d/.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const lis = items.map((it, j) => <li key={j}>{inline(it, `l${n}-${j}`)}</li>);
      blocks.push(ordered ? <ol key={n++}>{lis}</ol> : <ul key={n++}>{lis}</ul>);
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)])\s+|^#{1,4}\s|^\s*```/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={n++}>{inline(para.join(" "), `p${n}`)}</p>);
  }
  return <div className="md">{blocks}</div>;
}
