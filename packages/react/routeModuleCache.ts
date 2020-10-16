import type {
  AssetManifest,
  RouteLoader,
  RouteModule,
  RouteManifest
} from "@remix-run/core";

import invariant from "./invariant";

export type { RouteLoader, RouteManifest };

export interface RouteModuleCache {
  [routeId: string]: RouteModule;
}

export function createRouteLoader(
  initialRoutes: RouteModuleCache,
  publicPath: string
): RouteLoader {
  let cache: RouteModuleCache = initialRoutes;

  async function preload(assets: AssetManifest["entries"], routeId: string) {
    let entry = assets[routeId];

    invariant(entry, `Route "${routeId}" isn't in the build manifest`);

    let url = publicPath + entry.fileName;

    // @ts-ignore
    let routeModule = await import(url);

    cache[routeId] = routeModule;

    return routeModule;
  }

  function read(routeId: string): RouteModule {
    return cache[routeId];
  }

  return { preload, read };
}
