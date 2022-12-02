// TODO: RRR - Change import to @remix-run/router
import type {
  AgnosticDataRouteObject,
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/router";

import { type AppLoadContext } from "./data";
import { callRouteActionRR, callRouteLoaderRR } from "./data";
import type { ServerRouteModule } from "./routeModules";

export interface RouteManifest<Route> {
  [routeId: string]: Route;
}

export type ServerRouteManifest = RouteManifest<Omit<ServerRoute, "children">>;

// NOTE: make sure to change the Route in remix-react if you change this
export interface Route {
  index?: boolean;
  caseSensitive?: boolean;
  id: string;
  parentId?: string;
  path?: string;
}

// NOTE: make sure to change the EntryRoute in remix-react if you change this
export interface EntryRoute extends Route {
  hasAction: boolean;
  hasLoader: boolean;
  hasCatchBoundary: boolean;
  hasErrorBoundary: boolean;
  imports?: string[];
  module: string;
  parentId?: string;
}

export interface ServerRoute extends Route {
  children: ServerRoute[];
  module: ServerRouteModule;
}

function groupRoutesByParentId(manifest: ServerRouteManifest) {
  let routes: Record<string, Omit<ServerRoute, "children">[]> = {};

  Object.values(manifest).forEach((route) => {
    let parentId = route.parentId || "";
    if (!routes[parentId]) {
      routes[parentId] = [];
    }
    routes[parentId].push(route);
  });

  return routes;
}

export function createRoutes(
  manifest: ServerRouteManifest,
  parentId?: string,
  routesByParentId?: Record<string, Omit<ServerRoute, "children">[]>
): ServerRoute[] {
  // Create a map of routes by parentId to use recursively instead of
  // repeatedly filtering the manifest.
  routesByParentId ||= groupRoutesByParentId(manifest);

  return (routesByParentId[parentId || ""] || [])
    .map((route) => ({
      ...route,
      children: createRoutes(manifest, route.id, routesByParentId),
    }));
}


// Convert the Remix ServerManifest into DataRouteObject's for use with
// createStaticHandler
export function createStaticHandlerDataRoutes(
  manifest: ServerRouteManifest,
  loadContext: AppLoadContext,
  parentId?: string,
  routesByParentId?: Record<string, Omit<ServerRoute, "children">[]>
): AgnosticDataRouteObject[] {
  // Create a map of routes by parentId to use recursively instead of
  // repeatedly filtering the manifest.
  routesByParentId ||= groupRoutesByParentId(manifest);

  return (routesByParentId[parentId || ""] || [])
    .map((route) => {
      let commonRoute = {
        // Always include root due to default boundaries
        hasErrorBoundary:
          route.id === "root" ||
          route.module.CatchBoundary != null ||
          route.module.ErrorBoundary != null,
        id: route.id,
        path: route.path,
        loader: route.module.loader
          ? (args: LoaderFunctionArgs) =>
              callRouteLoaderRR({
                ...args,
                loadContext,
                loader: route.module.loader!,
                routeId: route.id,
              })
          : undefined,
        action: route.module.action
          ? (args: ActionFunctionArgs) =>
              callRouteActionRR({
                ...args,
                loadContext,
                action: route.module.action!,
                routeId: route.id,
              })
          : undefined,
        handle: route.module.handle,
        // TODO: RRR - Implement!
        shouldRevalidate: () => true,
      };

      return route.index
        ? {
            index: true,
            ...commonRoute,
          }
        : {
            caseSensitive: route.caseSensitive,
            children: createStaticHandlerDataRoutes(
              manifest,
              loadContext,
              route.id,
              routesByParentId
            ),
            ...commonRoute,
          };
    });
}
