import type { Params } from "react-router";

import type { BuildManifest, RouteModule } from "./build";
import type { LoaderResult } from "./loader";
import { LoaderResultCopy, LoaderResultSuccess } from "./loader";
import type { ConfigRouteObject, ConfigRouteMatch } from "./match";

export interface EntryContext {
  browserEntryContextString?: string;
  browserManifest: BuildManifest;
  globalData: GlobalData;
  matches: EntryRouteMatch[];
  publicPath: string;
  routeData: RouteData;
  routeLoader: RouteLoader;
  routeManifest: RouteManifest;
}

export interface EntryRouteObject {
  caseSensitive?: boolean;
  id: string;
  parentId?: string;
  path: string;
}

export interface EntryRouteMatch {
  params: Params;
  pathname: string;
  route: EntryRouteObject;
}

function createRoute(configRoute: ConfigRouteObject): EntryRouteObject {
  let route: EntryRouteObject = {
    id: configRoute.id,
    path: configRoute.path
  };

  if (typeof configRoute.caseSensitive !== "undefined") {
    route.caseSensitive = configRoute.caseSensitive;
  }

  if (configRoute.parentId) {
    route.parentId = configRoute.parentId;
  }

  return route;
}

export function createMatches(matches: ConfigRouteMatch[]): EntryRouteMatch[] {
  return matches.map(match => ({
    params: match.params,
    pathname: match.pathname,
    route: createRoute(match.route)
  }));
}

export interface RouteLoader {
  preload(assets: BuildManifest, routeId: string): Promise<RouteModule>;
  read(routeId: string): RouteModule;
}

export type GlobalData = any;

export function createGlobalData(loaderResult: LoaderResultSuccess) {
  return loaderResult.data;
}

export interface RouteData {
  [routeId: string]: any;
}

export function createRouteData(
  loaderResults: LoaderResult[]
): RouteDataResults {
  return loaderResults.reduce((memo, loaderResult) => {
    if (loaderResult instanceof LoaderResultSuccess) {
      memo[loaderResult.routeId] = loaderResult.data;
    }
    return memo;
  }, {} as RouteData);
}

export interface RouteDataResults {
  [routeId: string]: {
    type: "data" | "copy";
    data?: any;
  };
}

export function createRouteDataResults(
  loaderResults: LoaderResult[]
): RouteDataResults {
  return loaderResults.reduce((memo, loaderResult) => {
    if (loaderResult instanceof LoaderResultSuccess) {
      memo[loaderResult.routeId] = { type: "data", data: loaderResult.data };
    } else if (loaderResult instanceof LoaderResultCopy) {
      memo[loaderResult.routeId] = { type: "copy" };
    }
    return memo;
  }, {} as RouteDataResults);
}

export interface RouteManifest {
  [routeId: string]: EntryRouteObject;
}

export function createRouteManifest(
  matches: ConfigRouteMatch[]
): RouteManifest {
  return matches.reduce((memo, match) => {
    memo[match.route.id] = createRoute(match.route);
    return memo;
  }, {} as RouteManifest);
}
