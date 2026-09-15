import { isDemo } from "./status.js";

/**
 * Weather for the home screen widget, from Open-Meteo (free, no key).
 * Location comes from Settings; with none set we ask the network for a rough
 * one and fall back to demo data offline.
 */
export interface Weather {
  location: string;
  tempC: number;
  tempF: number;
  highF: number;
  lowF: number;
  code: number;
  summary: string;
  demo: boolean;
}

const SUMMARY: Array<[number[], string]> = [
  [[0], "Clear"], [[1], "Mostly sunny"], [[2], "Partly cloudy"], [[3], "Overcast"], [[45, 48], "Fog"],
  [[51, 53, 55, 56, 57], "Drizzle"], [[61, 63, 65, 66, 67], "Rain"], [[71, 73, 75, 77], "Snow"],
  [[80, 81, 82], "Showers"], [[85, 86], "Snow showers"], [[95, 96, 99], "Thunderstorms"],
];

function summary(code: number): string {
  return SUMMARY.find(([codes]) => codes.includes(code))?.[1] ?? "—";
}

const DEMO: Weather = { location: "San Francisco", tempC: 14, tempF: 58, highF: 62, lowF: 49, code: 1, summary: "Mostly sunny", demo: true };
let cache: { at: number; key: string; data: Weather } | null = null;

async function geocode(name: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`, { signal: AbortSignal.timeout(6000) });
  const j = (await r.json()) as { results?: Array<{ latitude: number; longitude: number; name: string; admin1?: string }> };
  const hit = j.results?.[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude, label: hit.name } : null;
}

async function locate(): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const r = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
    const j = (await r.json()) as { latitude?: number; longitude?: number; city?: string };
    if (j.latitude && j.longitude) return { lat: j.latitude, lon: j.longitude, label: j.city ?? "Here" };
  } catch {
    /* fall through to the timezone guess */
  }
  // No IP lookup: the system timezone names a nearby city ("America/Chicago").
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  const city = tz.split("/").pop()?.replace(/_/g, " ");
  if (city && city !== "UTC") return geocode(city).catch(() => null);
  return null;
}

export async function weather(location: string): Promise<Weather | null> {
  const key = location || "auto";
  if (cache && cache.key === key && Date.now() - cache.at < 15 * 60_000) return cache.data;
  try {
    const place = location ? await geocode(location) : await locate();
    if (!place) throw new Error("no location");
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`, { signal: AbortSignal.timeout(6000) });
    const j = (await r.json()) as { current: { temperature_2m: number; weather_code: number }; daily: { temperature_2m_max: number[]; temperature_2m_min: number[] } };
    const c = j.current.temperature_2m;
    const f = (x: number) => Math.round((x * 9) / 5 + 32);
    const data: Weather = { location: place.label, tempC: Math.round(c), tempF: f(c), highF: f(j.daily.temperature_2m_max[0]), lowF: f(j.daily.temperature_2m_min[0]), code: j.current.weather_code, summary: summary(j.current.weather_code), demo: false };
    cache = { at: Date.now(), key, data };
    return data;
  } catch {
    // Offline or no location. In demo mode show the canned reading, otherwise
    // hand back the last real one, or nothing at all. Never invent weather.
    if (await isDemo()) return { ...DEMO, location: location || DEMO.location };
    return cache ? { ...cache.data, demo: true } : null;
  }
}
