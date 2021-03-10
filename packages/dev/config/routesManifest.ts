import type { ConfigRoute } from "./routes";

export interface RouteManifest {
  [routeId: string]: Omit<ConfigRoute, "children">;
}

export function createRouteManifest(
  routes: ConfigRoute[],
  manifest: RouteManifest = {}
): RouteManifest {
  for (let route of routes) {
    let { children, ...rest } = route;
    manifest[route.id] = rest;
    if (children) {
      createRouteManifest(children, manifest);
    }
  }

  return manifest;
}
