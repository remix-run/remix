import type { Location } from "history";
import type { Params, RouteObject } from "react-router"; // TODO: export/import from react-router-dom
import { matchRoutes } from "react-router-dom";

import type { ClientRoute } from "./routes";

export interface RouteMatch<Route> {
  params: Params;
  pathname: string;
  route: Route;
}

export interface RouteMatchResult {
  matches: RouteMatch<ClientRoute>[];
  isNoMatch: boolean;
}

export function matchClientRoutes(
  routes: ClientRoute[],
  location: Location | string
): RouteMatchResult | null {
  let matches = matchRoutes((routes as unknown) as RouteObject[], location);

  // If no match for user defined routes, fall back to the root route only for the CatchBoundary
  if (!matches) {
    matches = matchRoutes((routes as unknown) as RouteObject[], "");
    matches?.splice(1);
  }

  if (!matches) return null;
  let isNoMatch = matches.length === 1;

  return {
    matches: matches.map(match => ({
      params: match.params,
      pathname: match.pathname,
      route: (match.route as unknown) as ClientRoute
    })),
    isNoMatch
  };
}
