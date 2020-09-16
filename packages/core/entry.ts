import type { Params } from "react-router";

import type { RouteModule } from "./build";
import type { LoaderResultSuccess } from "./loaderResults";
import type { RemixRouteMatch } from "./match";

export interface EntryContext {
  matchedRouteIds: string[];
  routeData: RouteData;
  routeManifest: RouteManifest;
  routeParams: RouteParams;
  requireRoute(id: string): RouteModule;
}

export interface RouteData {
  [routeId: string]: any;
}

export function createRouteData(
  loaderResults: LoaderResultSuccess[]
): RouteData {
  return loaderResults.reduce((memo, loaderResult) => {
    memo[loaderResult.routeId] = loaderResult.data;
    return memo;
  }, {} as RouteData);
}

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

export interface RouteParams {
  [routeId: string]: Params;
}

export function createRouteParams(matches: RemixRouteMatch[]): RouteParams {
  return matches.reduce((memo, match) => {
    memo[match.route.id] = match.params;
    return memo;
  }, {} as RouteParams);
}
