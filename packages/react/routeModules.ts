import type {
  EntryRouteObject,
  RouteModule,
  RouteModules
} from "@remix-run/core";

export type { RouteModule, RouteModules };

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

  try {
    let routeModule = await import(route.moduleUrl);
    routeModulesCache[route.id] = routeModule;
    return routeModule;
  } catch (error) {
    // User got caught in the middle of a deploy and the CDN no longer has the
    // asset we're trying to import! Reload from the server and the user
    // (should) get the new manifest--unless the developer purged the static
    // assets, the manifest path, but not the documents 😬
    window.location.reload();
    return new Promise(() => {
      // check out of this hook cause the DJs never gonna resolve this
    });
  }
}
