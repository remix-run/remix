import type { Location } from "history";
import type { RouteMatch, RouteObject } from "react-router";
import { matchRoutes } from "react-router";

import type { RemixRouteObject } from "./routes";

export interface RemixRouteMatch extends Omit<RouteMatch, "route"> {
  route: RemixRouteObject;
}

function matchRemixRoutes(
  routes: RemixRouteObject[],
  location: string | Location
): RemixRouteMatch[] | null {
  return matchRoutes((routes as unknown) as RouteObject[], location) as
    | RemixRouteMatch[]
    | null;
}

export { matchRemixRoutes as matchRoutes };

export interface RouteManifest {
  [routeId: string]: {
    id: string;
    parentId?: string;
    path: string;
  };
}

export function createRouteManifest(matches: RemixRouteMatch[]): RouteManifest {
  return matches.reduce((memo, match) => {
    memo[match.route.id] = {
      id: match.route.id,
      parentId: match.route.parentId,
      path: match.route.path
    };
    return memo;
  }, {} as RouteManifest);
}
