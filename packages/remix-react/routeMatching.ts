import type { Location } from "history";
import type { Params, RouteObject } from "react-router"; // TODO: export/import from react-router-dom
import { matchRoutes } from "react-router-dom";

import type { ClientRoute } from "./routes";

export interface RouteMatch<Route> {
  params: Params;
  pathname: string;
  route: Route;
}

export function matchClientRoutes(
  routes: ClientRoute[],
  location: Location | string
): RouteMatch<ClientRoute>[] | null {
  let matches = matchRoutes((routes as unknown) as RouteObject[], location);
  if (!matches) return null;

  return matches.map(match => ({
    params: match.params,
    pathname: match.pathname,
    route: (match.route as unknown) as ClientRoute
  }));
}
