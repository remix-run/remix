import type { BuildManifest, RouteLoader, RouteModule } from "@remix-run/core";

interface RouteModuleCache {
  [routeId: string]: RouteModule;
}

export function createSuspenseRouteModuleLoader(
  manifest: BuildManifest,
  publicPath: string
): RouteLoader {
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
