import jsesc from "jsesc";
import type { Params } from "react-router";

import type { AssetManifest, RouteModule, RouteModules } from "./build";
import type { RouteManifest } from "./config";
import type { AppLoadResult, AppData } from "./data";
import { extractData } from "./data";
import type { ConfigRouteObject, ConfigRouteMatch } from "./match";

export interface ServerHandoff {
  assets: AssetManifest;
  globalData: AppData;
  matches: EntryRouteMatch[];
  publicPath: string;
  routeData: RouteData;
  routes: RouteManifest<EntryRouteObject>;
}

export interface EntryContext extends ServerHandoff {
  routeLoader: RouteLoader;
  serverHandoffString?: string;
}

export interface EntryRouteObject {
  caseSensitive?: boolean;
  id: string;
  parentId?: string;
  path: string;
}

export function createEntryRoute(
  configRoute: ConfigRouteObject
): EntryRouteObject {
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

export interface EntryRouteMatch {
  params: Params;
  pathname: string;
  route: EntryRouteObject;
}

export function createEntryMatches(
  matches: ConfigRouteMatch[]
): EntryRouteMatch[] {
  return matches.map(match => ({
    params: match.params,
    pathname: match.pathname,
    route: createEntryRoute(match.route)
  }));
}

export function createGlobalData(loadResult: AppLoadResult): Promise<AppData> {
  return extractData(loadResult);
}

export interface RouteData {
  [routeId: string]: AppData;
}

export async function createRouteData(
  loadResults: AppLoadResult[],
  matches: ConfigRouteMatch[]
): Promise<RouteData> {
  let data = await Promise.all(loadResults.map(extractData));
  return matches.reduce((memo, match, index) => {
    memo[match.route.id] = data[index];
    return memo;
  }, {} as RouteData);
}

export interface RouteLoader {
  preload(assets: AssetManifest, routeId: string): Promise<RouteModule>;
  read(routeId: string): RouteModule;
}

export function createRouteLoader(routeModules: RouteModules): RouteLoader {
  return {
    preload() {
      throw new Error(
        `Cannot preload routes on the server because we can't suspend`
      );
    },
    read(routeId: string) {
      return routeModules[routeId];
    }
  };
}

export function createRouteManifest(
  matches: ConfigRouteMatch[]
): RouteManifest<EntryRouteObject> {
  return matches.reduce((memo, match) => {
    memo[match.route.id] = createEntryRoute(match.route);
    return memo;
  }, {} as RouteManifest<EntryRouteObject>);
}

export function createServerHandoffString(
  serverHandoff: ServerHandoff
): string {
  // Use jsesc to escape data returned from the loaders. This string is
  // inserted directly into the HTML in the `<Scripts>` element.
  return jsesc(serverHandoff, { isScriptContext: true });
}
