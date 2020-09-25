import type { BuildManifest, RouteLoader, RouteModule } from "@remix-run/core";

import invariant from "./invariant";

export type { RouteLoader };

interface RouteModuleCache {
  [routeId: string]: RouteModule;
}

export function createRouteLoader(publicPath: string): RouteLoader {
  let cache: RouteModuleCache = {};

  async function preload(assets: BuildManifest, routeId: string) {
    let entry = assets[routeId];

    invariant(entry, `Route "${routeId}" isn't in the build manifest`);

    let url = publicPath + entry.fileName;

    // @ts-ignore
    let routeModule = await import(url);

    cache[routeId] = routeModule;

    return routeModule;
  }

  function read(assets: BuildManifest, routeId: string): RouteModule {
    if (!cache[routeId]) throw preload(assets, routeId);
    return cache[routeId];
  }

  return { preload, read };
}
