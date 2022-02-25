// TODO: We eventually might not want to import anything directly from `history`
// and leverage `react-router` here instead
import type { Location } from "history";
import type { Params, RouteObject } from "react-router"; // TODO: export/import from react-router-dom
import { matchRoutes } from "react-router-dom";

import type { ClientRoute } from "./routes";
import type { Submission } from "./transition";

export interface RouteMatch<Route> {
  params: Params;
  pathname: string;
  route: Route;
}

export type ClientMatch = RouteMatch<ClientRoute>;

export function matchClientRoutes(
  routes: ClientRoute[],
  location: Location | string
): RouteMatch<ClientRoute>[] | null {
  let matches = matchRoutes(routes as unknown as RouteObject[], location);
  if (!matches) return null;

  return matches.map((match) => ({
    params: match.params,
    pathname: match.pathname,
    route: match.route as unknown as ClientRoute,
  }));
}

function isNewMatch(
  currentMatches: ClientMatch[],
  match: ClientMatch,
  index: number
) {
  if (!currentMatches[index]) return true;
  return match.route.id !== currentMatches[index].route.id;
}

function didMatchPathChange(
  currentMatches: ClientMatch[],
  match: ClientMatch,
  index: number
) {
  return (
    // param change, /users/123 -> /users/456
    currentMatches[index].pathname !== match.pathname ||
    // splat param changed, which is not present in match.path
    // e.g. /files/images/avatar.jpg -> files/finances.xls
    (currentMatches[index].route.path?.endsWith("*") &&
      currentMatches[index].params["*"] !== match.params["*"])
  );
}

export function shouldReloadForMatch(
  currentMatches: ClientMatch[],
  match: ClientMatch,
  index: number
) {
  return (
    isNewMatch(currentMatches, match, index) ||
    didMatchPathChange(currentMatches, match, index)
  );
}

export function filterByRoutePropsFactory(
  currentMatches: ClientMatch[],
  prevUrl: URL,
  url: URL,
  submission?: Submission
) {
  return (match: ClientMatch, index: number) => {
    if (!match.route.loader) {
      return false;
    }

    if (shouldReloadForMatch(currentMatches, match, index)) {
      return true;
    }

    if (match.route.shouldReload) {
      return match.route.shouldReload({
        prevUrl,
        url,
        submission,
        params: match.params,
      });
    }

    return true;
  };
}
