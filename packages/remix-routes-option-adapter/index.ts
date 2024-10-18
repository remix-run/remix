import {
  type UNSAFE_DefineRoutesFunction as DefineRoutesFunction,
  UNSAFE_defineRoutes as defineRoutes,
  UNSAFE_routeManifestToRouteConfig as routeManifestToRouteConfig,
} from "@remix-run/dev";
import { type RouteConfigEntry } from "@remix-run/route-config";

export type { DefineRoutesFunction };

/**
 * Adapter for [Remix's `routes` config
 * option](https://remix.run/docs/en/v2/file-conventions/vite-config#routes),
 * for use within `routes.ts`.
 */
export async function remixRoutesOptionAdapter(
  routes: (
    defineRoutes: DefineRoutesFunction
  ) =>
    | ReturnType<DefineRoutesFunction>
    | Promise<ReturnType<DefineRoutesFunction>>
): Promise<RouteConfigEntry[]> {
  let routeManifest = await routes(defineRoutes);
  return routeManifestToRouteConfig(routeManifest);
}
