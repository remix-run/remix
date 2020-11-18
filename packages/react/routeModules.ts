import type {
  EntryRouteObject,
  RouteModules,
  RouteModule
} from "@remix-run/core";

export type { RouteModules, RouteModule };

/**
 * Dynamically loads a route module from a bundle on the server.
 */
export async function loadRouteModule(
  route: EntryRouteObject,
  routeModulesCache: RouteModules
): Promise<RouteModule | null> {
  if (route.id in routeModulesCache) {
    return routeModulesCache[route.id];
  }

  if (!route.moduleUrl) {
    return Promise.resolve(null);
  }

  let routeModule = await import(route.moduleUrl);

  routeModulesCache[route.id] = routeModule;

  return routeModule;
}
