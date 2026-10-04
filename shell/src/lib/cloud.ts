import { useEffect } from "react";
import { useApi } from "../api/client";
import type { Settled, SourceState } from "../api/nextgent";

const STATES = ["offline", "not_connected", "not_paired", "not_configured"] as const;

/** The daemon prefixes a cloud failure with its state ("offline: …"); turn it back into one. */
export function settledFromError(error: string | null): Pick<Settled<unknown>, "state" | "error"> | null {
  if (!error) return null;
  const m = error.match(/^([a-z_]+): (.*)$/);
  if (m && (STATES as readonly string[]).includes(m[1])) return { state: m[1] as SourceState, error: m[2] };
  if (/^Could not reach|Failed to fetch|NetworkError/i.test(error)) return { state: "offline", error };
  return { state: "error", error };
}

/** useApi for a cloud route, with its failure as a SourceState and an optional refresh interval. */
export function useCloud<T>(path: string | null, refreshOn: string[] = [], pollMs = 0) {
  const r = useApi<T>(path, ["nextgent", ...refreshOn]);
  useEffect(() => {
    if (!pollMs || !path) return;
    const t = setInterval(() => void r.reload(), pollMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, pollMs, r.reload]);
  return { ...r, failure: settledFromError(r.error) };
}

/** "YYYY-MM-DDTHH:MM" (this computer's wall clock) or any ISO → Date. */
export function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const startOfWeek = (d: Date) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -d.getDay());

export const timeOf = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
export const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
export const longDay = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
export const dateTime = (v: string | null | undefined) => {
  const d = toDate(v ?? null);
  return d ? d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
};

/** "booking.created" → "Booking created". */
export function human(s: unknown): string {
  const t = String(s ?? "").replace(/[._-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Money as the payment recorded it, in the computer's locale; no currency is assumed. */
export function money(cents: number, currency?: string | null): string {
  const amount = cents / 100;
  if (!currency) return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  try {
    return amount.toLocaleString(undefined, { style: "currency", currency });
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
