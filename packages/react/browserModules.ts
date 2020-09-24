import type { BuildManifest, RouteLoader, RouteModule } from "@remix-run/core";

export function createRouteLoader(publicPath: string): RouteLoader {
  let cache: { [routeId: string]: RouteModule } = {};

  async function preload(assets: BuildManifest, routeId: string) {
    let entry = assets[routeId];
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

  function readSafely(_assets: BuildManifest, routeId: string) {
    return cache[routeId] || null;
  }

  return { preload, read, readSafely };
}
