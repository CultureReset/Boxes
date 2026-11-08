import { Fragment, type ReactNode } from "react";

/** Tiny, safe markdown: code blocks, headings, lists, bold/italic/inline code, links. No HTML is ever injected. */
function inline(t: string, k: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(t.slice(last, m.index));
    const s = m[0], key = `${k}-${i++}`;
    if (s.startsWith("`")) out.push(<code key={key}>{s.slice(1, -1)}</code>);
    else if (s.startsWith("**")) out.push(<b key={key}>{s.slice(2, -2)}</b>);
    else if (s.startsWith("[")) {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(s)!;
      const href = /^(https?:\/\/|\/)/.test(mm[2]) ? mm[2] : "#";
      out.push(<a key={key} href={href} target={href.startsWith("/") ? undefined : "_blank"} rel="noreferrer">{mm[1]}</a>);
    } else out.push(<i key={key}>{s.slice(1, -1)}</i>);
    last = m.index + s.length;
  }
  if (last < t.length) out.push(t.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const parts = text.split(/```/);
  parts.forEach((part, pi) => {
    if (pi % 2 === 1) {
      const body = part.replace(/^[\w+-]*\n/, "");
      blocks.push(<pre key={`c${pi}`} className="md-pre"><code>{body.replace(/\n$/, "")}</code></pre>);
      return;
    }
    let list: ReactNode[] = [], ordered = false;
    const flush = (k: string) => { if (list.length) { blocks.push(ordered ? <ol key={k}>{list}</ol> : <ul key={k}>{list}</ul>); list = []; } };
    part.split("\n").forEach((line, li) => {
      const k = `${pi}-${li}`;
      const ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line), h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (ul || ol) { const o = Boolean(ol); if (list.length && o !== ordered) flush(`l${k}`); ordered = o; list.push(<li key={k}>{inline((ul ?? ol)![1], k)}</li>); return; }
      flush(`l${k}`);
      if (h) blocks.push(<div key={k} className={`md-h md-h${h[1].length}`}>{inline(h[2], k)}</div>);
      else if (line.trim()) blocks.push(<p key={k}>{inline(line, k)}</p>);
    });
    flush(`end${pi}`);
  });
  return <div className="md">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
