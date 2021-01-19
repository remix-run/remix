import jsesc from "jsesc";
import type { Params } from "react-router";

import type { AssetManifest } from "./buildManifest";
import type { AppData, RouteModule, RouteModules } from "./buildModules";
import { extractData } from "./data";
import type { Response } from "./fetch";
import type { ConfigRouteObject, ConfigRouteMatch } from "./match";
import type { RouteManifest } from "./routes";

// We always serialize errors because we have to hydrate. Note: This is only
// for real errors that the developer didn't anticipate.
export interface SerializedError {
  message: string;
  stack?: string;
}

export function serializeError(error: Error): SerializedError {
  return {
    message: error.message,
    stack:
      error.stack &&
      error.stack.replace(
        /\((.+?)\)/g,
        (_match: string, file: string) => `(file://${file})`
      )
  };
}

/**
 * Because componentDidCatch is stateful it doesn't participate in server
 * rendering, we emulate it with this value. Each RemixRoute mutates the value
 * so we know which route was the last to attempt to render. We then use it to
 * render a second time along with the caught error and emulate
 * `componentDidCatch` on the server render 🎉. Optional because it only exists
 * in the server render, we don't hand this off to the browser because
 * componentDidCatch already works there
 */
export interface ComponentDidCatchEmulator {
  trackBoundaries: boolean;
  // `null` means the app layout threw before any routes rendered
  renderBoundaryRouteId: string | null;
  loaderBoundaryRouteId: string | null;
  error?: SerializedError;
}

export interface EntryContext {
  manifest: EntryManifest;
  matches: EntryRouteMatch[];
  componentDidCatchEmulator: ComponentDidCatchEmulator;
  routeData: RouteData;
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
  actionUrl?: string; // URL for calling the action
  loaderUrl?: string; // URL for calling the loader
}

export function createEntryRoute(
  configRoute: ConfigRouteObject,
  routeModule: RouteModule,
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
  if (typeof routeModule.action !== "undefined") {
    route.actionUrl = "/_remix/data";
  }
  if (typeof routeModule.loader !== "undefined") {
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

export interface RouteData {
  [routeId: string]: AppData;
}

export async function createRouteData(
  loadResults: Response[],
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
  routeModules: RouteModules,
  assets: AssetManifest["entries"],
  publicPath = "/"
): RouteManifest<EntryRouteObject> {
  return matches.reduce((memo, match) => {
    let route = match.route;
    let routeModule = routeModules[route.id];
    memo[route.id] = createEntryRoute(route, routeModule, assets, publicPath);
    return memo;
  }, {} as RouteManifest<EntryRouteObject>);
}

export function createServerHandoffString(serverHandoff: any): string {
  // Use jsesc to escape data returned from the loaders. This string is
  // inserted directly into the HTML in the `<Scripts>` element.
  return jsesc(serverHandoff, { isScriptContext: true });
}
