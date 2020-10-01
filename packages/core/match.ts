import type { Location } from "history";
import type { RouteObject, Params } from "react-router";
import { matchRoutes } from "react-router";

import type { ConfigRouteObject } from "./routes";

export type { ConfigRouteObject };

export interface ConfigRouteMatch {
  params: Params;
  pathname: string;
  route: ConfigRouteObject;
}

function matchConfigRoutes(
  routes: ConfigRouteObject[],
  location: string | Location
): ConfigRouteMatch[] | null {
  let matches = matchRoutes((routes as unknown) as RouteObject[], location);

  if (!matches) return null;

  return matches.map(match => ({
    params: match.params,
    pathname: match.pathname,
    route: (match.route as unknown) as ConfigRouteObject
  }));
}

export { matchConfigRoutes as matchRoutes };
