/**
 * The menu app's data layer.
 *
 * This app holds no database credential and knows no table names. It asks the
 * daemon on this box; the daemon asks the platform; the platform is the only
 * thing that touches the database. Three hops, one place where a key lives.
 *
 * Everything below returns the canonical shapes in `types/`, so a section
 * called `menu_items` for a restaurant and `service_menu` for a salon both
 * arrive here as items with a name and a price.
 */

import type { Menu, MenuItem, Special } from "../types";

const DAEMON = process.env.NEXT_PUBLIC_DAEMON_URL ?? "http://127.0.0.1:7770";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${DAEMON}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

const rows = <T,>(d: unknown): T[] =>
  Array.isArray(d) ? (d as T[]) : d && typeof d === "object" && Array.isArray((d as any).data) ? ((d as any).data as T[]) : [];

/** Normalise whatever the platform returned into one item shape. */
function toItem(r: any): MenuItem {
  return {
    id: String(r.id ?? r.item_id ?? ""),
    name: String(r.name ?? r.item_name ?? r.title ?? ""),
    description: r.description ?? r.item_description ?? undefined,
    price: Number(r.price ?? r.item_price ?? 0),
    image_url: r.image_url ?? r.photo_url ?? r.image ?? undefined,
    category: String(r.section ?? r.section_name ?? r.category ?? "Menu"),
    is_available: r.is_available !== false && r.available !== false,
  };
}

export const api = {
  /**
   * The menu for the business this box belongs to.
   *
   * The `id` and `pin` arguments the screens still pass are ignored. They come
   * from when this app stood alone and a six-digit PIN was the only thing
   * standing between a stranger and a restaurant's prices. On the box the owner
   * is already signed in — the box's own token is the authority — so a PIN here
   * would be a second, weaker lock on a door that is already locked.
   */
  async getMenu(_id?: string): Promise<Menu & { specials: Special[] }> {
    const [business, raw, specials] = await Promise.all([
      call<{ slug: string; businessName: string }>("/api/platform"),
      call<unknown>("/api/business/menu"),
      api.getSpecials().catch(() => [] as Special[]),
    ]);
    const items = rows<any>(raw).map(toItem);
    const categories = [...new Set(items.map((i) => i.category))].map((name, order) => ({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      order,
    }));
    return {
      id: business.slug,
      restaurant_name: business.businessName || business.slug,
      slug: business.slug,
      items,
      categories,
      specials,
      created_at: "",
      updated_at: new Date().toISOString(),
    };
  },

  /** There is one menu — the business's. Creating one is editing the one there is. */
  async createMenu(_restaurantName?: string, _description?: string, _themeColor?: string): Promise<Menu & { pin: string; theme_color: string }> {
    const m = await api.getMenu();
    // The screens still read `pin` and `theme_color` off a freshly made menu.
    // There is no PIN on the box; theme lives with the business.
    return { ...m, pin: "", theme_color: "#0a84ff" };
  },

  async updateMenu(_id: string, _pin: string, updates: Partial<Menu>): Promise<Menu> {
    await call("/api/business/menu", { method: "POST", body: JSON.stringify(updates) });
    return api.getMenu();
  },

  async addItem(_menuId: string, _pin: string, item: Partial<MenuItem>): Promise<MenuItem> {
    return call<MenuItem>("/api/business/menu/item", { method: "POST", body: JSON.stringify(item) });
  },

  async updateItem(itemId: string, _pin: string, updates: Partial<MenuItem>): Promise<MenuItem> {
    return call<MenuItem>("/api/business/menu/item", {
      method: "POST",
      body: JSON.stringify({ ...updates, id: itemId }),
    });
  },

  async deleteItem(itemId: string, _pin?: string): Promise<void> {
    await call(`/api/business/menu/item/${encodeURIComponent(itemId)}`, { method: "DELETE" });
  },

  async deleteSpecial(specialId: string, _pin?: string): Promise<void> {
    await call(`/api/business/specials/${encodeURIComponent(specialId)}`, { method: "DELETE" });
  },

  /** Call sites pass (menuId, pin, file) from when this app stood alone.
   *  Only the file matters here — the box's token is the authority. */
  async uploadImage(_menuId: string, _pin: string, file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${DAEMON}/api/business/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error("upload failed");
    return res.json();
  },

  async getSpecials(): Promise<Special[]> {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const raw = await call<unknown>(`/api/business/specials?from=${from}&to=${to}`);
    return rows<any>(raw).map((r) => ({
      id: String(r.id ?? ""),
      menu_id: "",
      title: String(r.title ?? r.name ?? ""),
      description: String(r.description ?? ""),
      image_url: r.image_url ?? undefined,
      start_date: String(r.start_date ?? r.starts_at ?? from),
      end_date: String(r.end_date ?? r.ends_at ?? to),
      type: (r.type ?? "special") as Special["type"],
    }));
  },

  /** The public URL a QR code points at. The page is rendered by the platform,
   *  so a scan works whether or not the box is on. */
  async publicMenuUrl(): Promise<string> {
    const p = await call<{ baseUrl: string; slug: string }>("/api/platform");
    return `${p.baseUrl.replace(/\/$/, "")}/m/${p.slug}`;
  },
};
