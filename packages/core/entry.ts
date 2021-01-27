import jsesc from "jsesc";
import type { Params } from "react-router";

import { AssetManifest, loadAssetManifest } from "./buildManifest";
import {
  AppData,
  loadRouteModules,
  RouteModule,
  RouteModules
} from "./buildModules";
import { RemixConfig } from "./config";
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
  entryModuleUrl: string;
  entryModuleImports: string[];
  manifestUrl: string;
}

export interface EntryRouteObject {
  id: string;
  path: string;
  caseSensitive?: boolean;
  parentId?: string;
  hasAction?: boolean;
  hasLoader?: boolean;
  // TODO: can this really be undefined? How?
  moduleUrl?: string; // URL of the route module for `import`
  // nomoduleUrl?: string; // URL of the route module for `SystemJS.import`
  stylesUrl?: string; // URL for loading the CSS
  imports?: string[]; // URLs of modules that need to be imported with this one
}

export function createEntryRoute(
  configRoute: ConfigRouteObject,
  routeModule: RouteModule,
  assets: AssetManifest["entries"],
  publicPath = "/"
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
  // TODO: isn't this always true?
  if (assets[route.id]) {
    route.moduleUrl = publicPath + assets[route.id].file;
    route.imports = assets[route.id].imports?.map(path => publicPath + path);
  }
  if (assets[`${route.id}.css`]) {
    route.stylesUrl = publicPath + assets[`${route.id}.css`].file;
  }
  if (typeof routeModule.action !== "undefined") {
    route.hasAction = true;
  }
  if (typeof routeModule.loader !== "undefined") {
    route.hasLoader = true;
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

/**
 * Gets the whole manifest in preparation for moving this stuff to rollup and
 * building a static manifest for each deployment
 */
export function getManifest(config: RemixConfig): EntryManifest {
  let assetManifest = loadAssetManifest(config.serverBuildDirectory);

  let routeModules = loadRouteModules(
    config.serverBuildDirectory,
    Object.keys(config.routeManifest)
  );

  let routes = Object.keys(config.routeManifest).reduce((memo, routeId) => {
    let route = config.routeManifest[routeId];
    let routeModule = routeModules[routeId];
    memo[routeId] = createEntryRoute(
      route,
      routeModule,
      assetManifest.entries,
      config.publicPath
    );
    return memo;
  }, {} as RouteManifest<EntryRouteObject>);

  let entryImports = assetManifest.entries["entry-browser"].imports!.map(
    path => config.publicPath + path
  );

  for (let routeId in routes) {
    removeParentImports(routeId, routes, entryImports);
  }

  let entryModuleImports = (
    assetManifest.entries["entry-browser"].imports || []
  ).map(filePath => config.publicPath + filePath);

  return {
    version: assetManifest.version,
    routes,
    entryModuleUrl:
      config.publicPath + assetManifest.entries["entry-browser"].file,
    entryModuleImports,
    manifestUrl:
      config.publicPath + `remix-manifest-${assetManifest.version}.js`
  };
}

// Each entry has a list of imports with lots of duplicates between routes. We
// know that a child route is never rendered without its parent route, so we can
// remove any imports that we know will already be declared in the parent route,
// greatly reduce file size of manifest, also makes it easy to add
// modulepreloads w/o having to dedupe each time you need them.
//
// TODO: I'm sure // there's a WAY better way to do this, also should probably
// be done in the rollup manifest plugin during build instead of at runtime.
function removeParentImports(
  routeId: string,
  routes: RouteManifest<EntryRouteObject>,
  entryImports: string[]
) {
  let route = routes[routeId];
  if (!route.imports) return;

  let parentImports = new Set(entryImports);

  if (route.parentId) {
    let parents = getParents(route, routes);
    parents
      .map(parent => parent.imports!)
      .flat(1)
      .forEach(path => parentImports.add(path));
  }

  route.imports = route.imports.filter(path => {
    return !parentImports.has(path);
  });
}

function getParents(
  route: EntryRouteObject,
  routes: RouteManifest<EntryRouteObject>,
  parents: EntryRouteObject[] = []
) {
  if (route.parentId) {
    let parent = routes[route.parentId];
    parents.unshift(parent);
    if (parent.parentId) {
      getParents(parent, routes, parents);
    }
  }
  return parents;
}
