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
