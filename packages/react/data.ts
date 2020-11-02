import type { Location } from "history";
import type { Params } from "react-router";
import type { AppData, RouteData } from "@remix-run/core";

import type { Manifest } from "./manifest";
import invariant from "./invariant";

export type { AppData, RouteData };

export interface DataRedirectHandler {
  (url: URL): void;
}

/**
 * Dynamically loads some data for a route from the server.
 */
export function loadRouteData(
  manifest: Manifest,
  location: Location,
  routeParams: Params,
  routeId: string,
  handleRedirect: DataRedirectHandler
): Promise<AppData> {
  let route = manifest.routes[routeId];

  invariant(route, `Route "${routeId}" isn't in the route manifest`);

  if (!route.hasLoader) {
    return Promise.resolve(null);
  }

  return fetchData(location, routeParams, routeId, handleRedirect);
}

async function fetchData(
  location: Location,
  routeParams: Params,
  routeId: string,
  handleRedirect: DataRedirectHandler
): Promise<AppData> {
  let origin = window.location.origin;
  let url = new URL(location.pathname + location.search, origin);
  let params = new URLSearchParams({
    url: url.toString(),
    params: JSON.stringify(routeParams),
    id: routeId
  });
  let res = await fetch(`/_remix/data?${params.toString()}`);

  if (res.redirected) {
    handleRedirect(new URL(res.url));
  }

  // We discussed possibly reloading here to get the right status code from the
  // server for the HTML page when the data loader returns a 404, but ultimately
  // concluded it's probably better to just not have any JavaScript on the page
  // when search bots come around to index things.

  return extractData(res);
}

function extractData(res: Response): AppData {
  // This same algorithm is used on the server to interpret load
  // results when we render the HTML page.
  let contentType = res.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return res.json();
  }

  return res.text();
}
