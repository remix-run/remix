import type { Location } from "history";
import type { Params } from "react-router";
import type { AppData, RouteData } from "@remix-run/core";

import type { Manifest } from "./manifest";
import invariant from "./invariant";

export type { AppData, RouteData };

/**
 * Dynamically loads some data for a route from the server.
 */
export function loadRouteData(
  manifest: Manifest,
  location: Location,
  routeParams: Params,
  routeId: string
): Promise<AppData> {
  let route = manifest.routes[routeId];

  invariant(route, `Route "${routeId}" isn't in the route manifest`);

  if (!route.hasLoader) {
    return Promise.resolve(null);
  }

  return fetchData(location, routeParams, routeId);
}

async function fetchData(
  location: Location,
  routeParams: Params,
  routeId: string
): Promise<AppData> {
  let url = new URL(
    location.pathname + location.search,
    window.location.origin
  );
  let params = new URLSearchParams({
    url: url.toString(),
    params: JSON.stringify(routeParams),
    id: routeId
  });
  let res = await fetch(`/_remix/data?${params.toString()}`);
  let contentType = res.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return res.json();
  }

  return res.text();
}
