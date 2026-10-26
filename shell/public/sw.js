/* NODE service worker: the app shell lives on the phone, all work happens on the desktop.
 * - /api/* is NEVER intercepted or cached: it always goes over the network to the desktop.
 * - Navigations: served from cache instantly, refreshed in the background.
 * - Static assets (hashed /assets/*, icons, manifest): cache-first. */
const CACHE = "node-shell-v3";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(SHELL);
    // Precache the hashed bundles that index.html references.
    const html = await (await fetch("/", { cache: "no-store" })).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    await c.addAll(assets);
  }).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/api" || url.pathname.startsWith("/door")) return; // network only, never cached

  if (req.mode === "navigate") {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const cached = await c.match("/");
      const fresh = fetch(req).then(async (r) => {
        if (r.ok) {
          await c.put("/", r.clone());
          // New deploy: pull in its bundles too.
          const html = await r.clone().text();
          for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) if (!(await c.match(m[1]))) c.add(m[1]).catch(() => {});
        }
        return r;
      }).catch(() => cached);
      return cached || fresh;
    }));
    return;
  }

  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    if (hit) return hit;
    const r = await fetch(req);
    if (r.ok && (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname))) c.put(req, r.clone());
    return r;
  }));
});
