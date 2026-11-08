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
