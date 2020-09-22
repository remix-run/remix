import type { Params } from "react-router";

import type { BuildManifest, RouteModule } from "./build";
import type { RemixConfig } from "./config";
import type { LoaderResult } from "./loader";
import { LoaderResultCopy, LoaderResultSuccess } from "./loader";
import type { RemixRouteMatch } from "./match";

export interface EntryContext {
  browserManifest: BuildManifest;
  browserEntryContextString?: string; // Only needed on the server
  publicPath: RemixConfig["publicPath"];
  routeData: RouteData;
  routeManifest: RouteManifest;
  routeParams: RouteParams;
  routeLoader: RouteLoader;
}

export interface RouteLoader {
  read(routeId: string): RouteModule;
  load(routeId: string): Promise<void>;
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
  [routeId: string]: {
    id: string;
    parentId?: string;
    path: string;
  };
}

export function createRouteManifest(matches: RemixRouteMatch[]): RouteManifest {
  return matches.reduce((memo, match) => {
    let route: RouteManifest[string] = {
      id: match.route.id,
      path: match.route.path
    };

    if (match.route.parentId) {
      route.parentId = match.route.parentId;
    }

    memo[match.route.id] = route;

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
