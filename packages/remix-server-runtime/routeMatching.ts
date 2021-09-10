import type { Params, RouteObject } from "react-router"; // TODO: export/import from react-router-dom
import { matchRoutes } from "react-router-dom";

import type { ServerRoute } from "./routes";

export interface RouteMatch<Route> {
  params: Params;
  pathname: string;
  route: Route;
}

export interface RouteMatchResult {
  matches: RouteMatch<ServerRoute>[];
  isNoMatch: boolean;
}

export function matchServerRoutes(
  routes: ServerRoute[],
  pathname: string
): RouteMatchResult | null {
  let isNoMatch = false;
  let matches = matchRoutes((routes as unknown) as RouteObject[], pathname);

  // If no match for user defined routes, fall back to the root route only for the CatchBoundary
  if (!matches) {
    matches = matchRoutes((routes as unknown) as RouteObject[], "");
    matches?.splice(1);
  }

  if (!matches) return null;
  isNoMatch = matches.length === 1;

  return {
    matches: matches.map(match => ({
      params: match.params,
      pathname: match.pathname,
      route: (match.route as unknown) as ServerRoute
    })),
    isNoMatch
  };
}
