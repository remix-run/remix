import * as React from "react";
import type {
  ActionFunction,
  DataRouteObject,
  LoaderFunction,
  ShouldRevalidateFunction,
} from "react-router-dom";
import { redirect } from "react-router-dom";

import type { RouteModules } from "./routeModules";
import { loadRouteModule } from "./routeModules";
import {
  fetchData,
  isCatchResponse,
  isDeferredResponse,
  isRedirectResponse,
  parseDeferredReadableStream,
} from "./data";
import type { FutureConfig } from "./entry";
import { prefetchStyleLinks } from "./links";
import invariant from "./invariant";
import { RemixRoute, RemixRouteError } from "./components";

export interface RouteManifest<Route> {
  [routeId: string]: Route;
}

// NOTE: make sure to change the Route in server-runtime if you change this
interface Route {
  index?: boolean;
  caseSensitive?: boolean;
  id: string;
  parentId?: string;
  path?: string;
}

// NOTE: make sure to change the EntryRoute in server-runtime if you change this
export interface EntryRoute extends Route {
  hasAction: boolean;
  hasLoader: boolean;
  hasCatchBoundary: boolean;
  hasErrorBoundary: boolean;
  imports?: string[];
  module: string;
  parentId?: string;
}

// Create a map of routes by parentId to use recursively instead of
// repeatedly filtering the manifest.
function groupRoutesByParentId(manifest: RouteManifest<EntryRoute>) {
  let routes: Record<string, Omit<EntryRoute, "children">[]> = {};

  Object.values(manifest).forEach((route) => {
    let parentId = route.parentId || "";
    if (!routes[parentId]) {
      routes[parentId] = [];
    }
    routes[parentId].push(route);
  });

  return routes;
}

export function createServerRoutes(
  manifest: RouteManifest<EntryRoute>,
  routeModules: RouteModules,
  future: FutureConfig,
  parentId: string = "",
  routesByParentId: Record<
    string,
    Omit<EntryRoute, "children">[]
  > = groupRoutesByParentId(manifest)
): DataRouteObject[] {
  return (routesByParentId[parentId] || []).map((route) => {
    let hasErrorBoundary =
      future.v2_errorBoundary === true
        ? route.id === "root" || route.hasErrorBoundary
        : route.id === "root" ||
          route.hasCatchBoundary ||
          route.hasErrorBoundary;
    let dataRoute: DataRouteObject = {
      caseSensitive: route.caseSensitive,
      element: <RemixRoute id={route.id} />,
      errorElement: hasErrorBoundary ? (
        <RemixRouteError id={route.id} />
      ) : undefined,
      id: route.id,
      index: route.index,
      path: route.path,
      handle: routeModules[route.id].handle,
      // Note: we don't need loader/action/shouldRevalidate on these routes
      // since they're for a static render
    };

    let children = createServerRoutes(
      manifest,
      routeModules,
      future,
      route.id,
      routesByParentId
    );
    if (children.length > 0) dataRoute.children = children;
    return dataRoute;
  });
}

export function createClientRoutesWithHMRRevalidationOptOut(
  needsRevalidation: Set<string>,
  manifest: RouteManifest<EntryRoute>,
  routeModulesCache: RouteModules,
  future: FutureConfig
) {
  return createClientRoutes(
    manifest,
    routeModulesCache,
    future,
    "",
    groupRoutesByParentId(manifest),
    needsRevalidation
  );
}

export function createClientRoutes(
  manifest: RouteManifest<EntryRoute>,
  routeModulesCache: RouteModules,
  future: FutureConfig,
  parentId: string = "",
  routesByParentId: Record<
    string,
    Omit<EntryRoute, "children">[]
  > = groupRoutesByParentId(manifest),
  needsRevalidation?: Set<string>
): DataRouteObject[] {
  return (routesByParentId[parentId] || []).map((route) => {
    let hasErrorBoundary =
      future.v2_errorBoundary === true
        ? route.id === "root" || route.hasErrorBoundary
        : route.id === "root" ||
          route.hasCatchBoundary ||
          route.hasErrorBoundary;

    let dataRoute: DataRouteObject = {
      caseSensitive: route.caseSensitive,
      element: <RemixRoute id={route.id} />,
      errorElement: hasErrorBoundary ? (
        <RemixRouteError id={route.id} />
      ) : undefined,
      id: route.id,
      index: route.index,
      path: route.path,
      // handle gets added in via useMatches since we aren't guaranteed to
      // have the route module available here
      handle: undefined,
      loader: createDataFunction(route, routeModulesCache, false),
      action: createDataFunction(route, routeModulesCache, true),
      shouldRevalidate: createShouldRevalidate(
        route,
        routeModulesCache,
        needsRevalidation
      ),
    };
    let children = createClientRoutes(
      manifest,
      routeModulesCache,
      future,
      route.id,
      routesByParentId,
      needsRevalidation
    );
    if (children.length > 0) dataRoute.children = children;
    return dataRoute;
  });
}

function createShouldRevalidate(
  route: EntryRoute,
  routeModules: RouteModules,
  needsRevalidation?: Set<string>
): ShouldRevalidateFunction {
  let handledRevalidation = false;
  return function (arg) {
    let module = routeModules[route.id];
    invariant(module, `Expected route module to be loaded for ${route.id}`);

    // When an HMR / HDR update happens we opt out of all user-defined
    // revalidation logic and the do as the dev server tells us the first
    // time router.revalidate() is called.
    if (needsRevalidation !== undefined && !handledRevalidation) {
      handledRevalidation = true;
      return needsRevalidation.has(route.id);
    }

    if (module.shouldRevalidate) {
      return module.shouldRevalidate(arg);
    }

    return arg.defaultShouldRevalidate;
  };
}

async function loadRouteModuleWithBlockingLinks(
  route: EntryRoute,
  routeModules: RouteModules
) {
  let routeModule = await loadRouteModule(route, routeModules);
  await prefetchStyleLinks(routeModule);
  return routeModule;
}

function createDataFunction(
  route: EntryRoute,
  routeModules: RouteModules,
  isAction: boolean
): LoaderFunction | ActionFunction {
  return async ({ request }) => {
    let routeModulePromise = loadRouteModuleWithBlockingLinks(
      route,
      routeModules
    );
    try {
      if (isAction && !route.hasAction) {
        let msg =
          `Route "${route.id}" does not have an action, but you are trying ` +
          `to submit to it. To fix this, please add an \`action\` function to the route`;
        console.error(msg);
        throw new Error(msg);
      } else if (!isAction && !route.hasLoader) {
        return null;
      }

      let result = await fetchData(request, route.id);

      if (result instanceof Error) {
        throw result;
      }

      if (isRedirectResponse(result)) {
        throw getRedirect(result);
      }

      if (isCatchResponse(result)) {
        throw result;
      }

      if (isDeferredResponse(result) && result.body) {
        return await parseDeferredReadableStream(result.body);
      }

      return result;
    } finally {
      await routeModulePromise;
    }
  };
}

function getRedirect(response: Response): Response {
  let status = parseInt(response.headers.get("X-Remix-Status")!, 10) || 302;
  let url = response.headers.get("X-Remix-Redirect")!;
  let headers: Record<string, string> = {};
  let revalidate = response.headers.get("X-Remix-Revalidate");
  if (revalidate) {
    headers["X-Remix-Revalidate"] = revalidate;
  }
  return redirect(url, { status, headers });
}
