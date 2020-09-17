import type { BuildManifest, RouteModule } from "@remix-run/core";

export interface SuspenseRouteModuleLoader {
  read(routeId: string): RouteModule;
  load(routeId: string): Promise<void>;
}

interface RouteModuleCache {
  [routeId: string]: RouteModule;
}

export function createSuspenseRouteModuleLoader(
  manifest: BuildManifest,
  publicPath: string
): SuspenseRouteModuleLoader {
  let cache: RouteModuleCache = {};

  function read(routeId: string): RouteModule {
    let routeModule = cache[routeId];
    if (routeModule) return routeModule;
    throw load(routeId);
  }

  async function load(routeId: string) {
    let entry = manifest[routeId];
    let url = publicPath + entry.fileName;
    // @ts-ignore
    let mod = await import(url);
    cache[routeId] = mod;
  }

  return { read, load };
}
