import type http from "node:http";
import { spawn } from "node:child_process";

/**
 * Live view of one desktop window as MJPEG (multipart/x-mixed-replace), so the
 * NODE app can show a desktop program inside its own in-app view. View only.
 * Captures with xwd | convert on the box's X display (:10 under xrdp).
 */
function grab(address: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const env = { ...process.env, DISPLAY: process.env.DISPLAY ?? ":10.0" };
    const p = spawn("sh", ["-c", `xwd -silent -id "$0" | convert xwd:- -resize '1280x1280>' -quality 60 jpg:-`, address], { env });
    const chunks: Buffer[] = [];
    const t = setTimeout(() => p.kill("SIGKILL"), 4000);
    p.stdout.on("data", (c: Buffer) => chunks.push(c));
    p.on("close", (code) => { clearTimeout(t); resolve(code === 0 && chunks.length ? Buffer.concat(chunks) : null); });
    p.on("error", () => { clearTimeout(t); resolve(null); });
  });
}

export async function streamWindow(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const u = new URL(req.url ?? "", "http://x");
  const address = u.searchParams.get("address") ?? "";
  const once = u.searchParams.get("once") === "1";
  if (!/^0x[0-9a-f]{1,10}$/i.test(address)) { res.writeHead(400); res.end("bad address"); return; }
  if (once) {
    const f = await grab(address);
    if (!f) { res.writeHead(404); res.end("window not available"); return; }
    res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "no-store" });
    res.end(f); return;
  }
  const fps = Math.min(8, Math.max(1, Number(u.searchParams.get("fps") ?? 4)));
  res.writeHead(200, { "content-type": "multipart/x-mixed-replace; boundary=frame", "cache-control": "no-store", connection: "close" });
  let alive = true;
  req.on("close", () => { alive = false; });
  let misses = 0;
  while (alive && misses < 10) {
    const t0 = Date.now();
    const f = await grab(address);
    if (!f) misses++; else {
      misses = 0;
      res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${f.length}\r\n\r\n`);
      res.write(f); res.write("\r\n");
    }
    await new Promise((r) => setTimeout(r, Math.max(0, 1000 / fps - (Date.now() - t0))));
  }
  res.end();
}
