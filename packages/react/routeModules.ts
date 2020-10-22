import type { RouteModules, RouteModule } from "@remix-run/core";

import type { Manifest } from "./manifest";
import invariant from "./invariant";

export type { RouteModules, RouteModule };

/**
 * Dynamically loads a route module from a bundle on the server.
 */
export async function loadRouteModule(
  manifest: Manifest,
  publicPath: string,
  routeId: string,
  routeModulesCache: RouteModules
): Promise<RouteModule> {
  if (routeId in routeModulesCache) {
    return routeModulesCache[routeId];
  }

  let asset = manifest.assets[routeId];

  invariant(asset, `Route "${routeId}" isn't in the asset manifest`);

  let url = publicPath + asset.file;
  let routeModule = await import(url);

  routeModulesCache[routeId] = routeModule;

  return routeModule;
}
