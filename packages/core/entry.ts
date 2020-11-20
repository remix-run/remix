import jsesc from "jsesc";
import type { Params } from "react-router";

import type { AssetManifest, RouteModules } from "./build";
import type { AppLoadResult, AppData } from "./data";
import { extractData } from "./data";
import type { ConfigRouteObject, ConfigRouteMatch } from "./match";
import type { RouteManifest } from "./routes";

export interface ServerHandoff {
  globalData: AppData;
  manifest: EntryManifest;
  matches: EntryRouteMatch[];
  routeData: RouteData;
}

export interface EntryContext extends ServerHandoff {
  routeModules: RouteModules;
  serverHandoffString?: string;
}

export interface EntryManifest {
  version: AssetManifest["version"];
  routes: RouteManifest<EntryRouteObject>;
  entryModuleUrl?: string;
  globalStylesUrl?: string;
}

export interface EntryRouteObject {
  path: string;
  caseSensitive?: boolean;
  id: string;
  parentId?: string;
  moduleUrl?: string; // URL of the route module for `import`
  // nomoduleUrl?: string; // URL of the route module for `SystemJS.import`
  stylesUrl?: string; // URL for loading the CSS
  loaderUrl?: string; // URL for calling the loader
}

export function createEntryRoute(
  configRoute: ConfigRouteObject,
  assets: AssetManifest["entries"],
  publicPath = "/"
): EntryRouteObject {
  let route: EntryRouteObject = {
    path: configRoute.path,
    id: configRoute.id
  };

  if (typeof configRoute.caseSensitive !== "undefined") {
    route.caseSensitive = configRoute.caseSensitive;
  }
  if (configRoute.parentId) {
    route.parentId = configRoute.parentId;
  }
  if (assets[route.id]) {
    route.moduleUrl = publicPath + assets[route.id].file;
  }
  if (assets[`${route.id}.css`]) {
    route.stylesUrl = publicPath + assets[`${route.id}.css`].file;
  }
  if (configRoute.loaderFile) {
    route.loaderUrl = "/_remix/data";
  }

  return route;
}

export interface EntryRouteMatch {
  params: Params;
  pathname: string;
  route: EntryRouteObject;
}

export function createEntryMatches(
  entryRoutes: RouteManifest<EntryRouteObject>,
  matches: ConfigRouteMatch[]
): EntryRouteMatch[] {
  return matches.map(match => ({
    params: match.params,
    pathname: match.pathname,
    route: entryRoutes[match.route.id]
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

export function createRouteManifest(
  matches: ConfigRouteMatch[],
  assets: AssetManifest["entries"],
  publicPath = "/"
): RouteManifest<EntryRouteObject> {
  return matches.reduce((memo, match) => {
    memo[match.route.id] = createEntryRoute(match.route, assets, publicPath);
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
