import * as React from "react";
import { UNSAFE_ErrorResponseImpl as ErrorResponse } from "@remix-run/router";
import type {
  DataRouteObject,
  ShouldRevalidateFunction,
} from "react-router-dom";
import { redirect, useRouteError } from "react-router-dom";

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
import { RemixRootDefaultErrorBoundary } from "./errorBoundaries";

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
    let routeModule = routeModules[route.id];
    let dataRoute: DataRouteObject = {
      caseSensitive: route.caseSensitive,
      Component: routeModule.default,
      ErrorBoundary: routeModule.ErrorBoundary
        ? routeModule.ErrorBoundary
        : route.id === "root"
        ? () => <RemixRootDefaultErrorBoundary error={useRouteError()} />
        : undefined,
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
    let routeModule = routeModulesCache?.[route.id];
    let dataRoute: DataRouteObject = {
      id: route.id,
      index: route.index,
      path: route.path,
      async loader({ request }) {
        // Only prefetch links if we've been loaded into the cache, route.lazy
        // will handle initial loads
        let routeModulePromise = routeModulesCache[route.id]
          ? prefetchStyleLinks(routeModulesCache[route.id])
          : Promise.resolve();
        try {
          if (!route.hasLoader) return null;
          return fetchServerHandler(request, route);
        } finally {
          await routeModulePromise;
        }
      },
      async action({ request }) {
        // Only prefetch links if we've been loaded into the cache, route.lazy
        // will handle initial loads
        let routeModulePromise = routeModulesCache[route.id]
          ? prefetchStyleLinks(routeModulesCache[route.id])
          : Promise.resolve();
        try {
          if (!route.hasAction) {
            let msg =
              `Route "${route.id}" does not have an action, but you are trying ` +
              `to submit to it. To fix this, please add an \`action\` function to the route`;
            console.error(msg);
            return Promise.reject(
              new ErrorResponse(405, "Method Not Allowed", new Error(msg), true)
            );
          }

          return fetchServerHandler(request, route);
        } finally {
          await routeModulePromise;
        }
      },
      ...(routeModule
        ? // Use critical path modules directly
          {
            Component: routeModule.default,
            ErrorBoundary: routeModule.ErrorBoundary
              ? routeModule.ErrorBoundary
              : route.id === "root"
              ? () => <RemixRootDefaultErrorBoundary error={useRouteError()} />
              : undefined,
            handle: routeModule.handle,
            shouldRevalidate: needsRevalidation
              ? wrapShouldRevalidateForHdr(
                  route.id,
                  routeModule.shouldRevalidate,
                  needsRevalidation
                )
              : routeModule.shouldRevalidate,
          }
        : // Load all other modules via route.lazy()
          {
            lazy: async () => {
              let mod = await loadRouteModuleWithBlockingLinks(
                route,
                routeModulesCache
              );
              if (needsRevalidation) {
                mod.shouldRevalidate = wrapShouldRevalidateForHdr(
                  route.id,
                  mod.shouldRevalidate,
                  needsRevalidation
                );
              }
              return mod;
            },
          }),
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

// When an HMR / HDR update happens we opt out of all user-defined
// revalidation logic and force a revalidation on the first call
function wrapShouldRevalidateForHdr(
  routeId: string,
  routeShouldRevalidate: ShouldRevalidateFunction | undefined,
  needsRevalidation: Set<string>
): ShouldRevalidateFunction {
  let handledRevalidation = false;
  return (arg) => {
    if (!handledRevalidation) {
      handledRevalidation = true;
      return needsRevalidation.has(routeId);
    }

    return routeShouldRevalidate
      ? routeShouldRevalidate(arg)
      : arg.defaultShouldRevalidate;
  };
}

async function loadRouteModuleWithBlockingLinks(
  route: EntryRoute,
  routeModules: RouteModules
) {
  let routeModule = await loadRouteModule(route, routeModules);
  await prefetchStyleLinks(routeModule);

  // Resource routes are built with an empty object as the default export -
  // ignore those when setting the Component
  let defaultExportIsEmptyObject =
    typeof routeModule.default === "object" &&
    Object.keys(routeModule.default || {}).length === 0;

  // Include all `browserSafeRouteExports` fields
  return {
    ...(routeModule.default != null && !defaultExportIsEmptyObject
      ? { Component: routeModule.default }
      : {}),
    ErrorBoundary: routeModule.ErrorBoundary,
    handle: routeModule.handle,
    links: routeModule.links,
    meta: routeModule.meta,
    shouldRevalidate: routeModule.shouldRevalidate,
  };
}

async function fetchServerHandler(request: Request, route: EntryRoute) {
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
}

function getRedirect(response: Response): Response {
  let status = parseInt(response.headers.get("X-Remix-Status")!, 10) || 302;
  let url = response.headers.get("X-Remix-Redirect")!;
  let headers: Record<string, string> = {};
  let revalidate = response.headers.get("X-Remix-Revalidate");
  if (revalidate) {
    headers["X-Remix-Revalidate"] = revalidate;
  }
  let reloadDocument = response.headers.get("X-Remix-Reload-Document");
  if (reloadDocument) {
    headers["X-Remix-Reload-Document"] = reloadDocument;
  }
  return redirect(url, { status, headers });
}
