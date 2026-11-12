import { useEffect, useState } from "react";

export interface Route {
  screen: string;
  sub?: string;
  params: URLSearchParams;
}

function parse(): Route {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = hash.split("?");
  const [screen = "home", sub] = pathPart.split("/");
  return { screen: screen || "home", sub, params: new URLSearchParams(queryPart ?? "") };
}

export function navigate(screen: string, sub?: string, params?: Record<string, string>) {
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  window.location.hash = `/${screen}${sub ? `/${sub}` : ""}${q}`;
  // Fire even when the hash did not change (e.g. Home while an app is open)
  // so the app view closes and the persistent header stays in control.
  window.dispatchEvent(new CustomEvent("node:navigate", { detail: { screen, sub } }));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
