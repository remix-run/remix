import * as React from "react";
import type {
  HydrationState,
  UNSAFE_DeferredData as DeferredData,
} from "@remix-run/router";
import {
  UNSAFE_ErrorResponseImpl as ErrorResponse,
  json as routerJson,
} from "@remix-run/router";
import type {
  ActionFunctionArgs as RRActionFunctionArgs,
  LoaderFunctionArgs as RRLoaderFunctionArgs,
  DataRouteObject,
  ShouldRevalidateFunction,
} from "react-router-dom";
import { redirect, useRouteError } from "react-router-dom";

import type {
  ClientActionFunction,
  ClientLoaderFunction,
  RouteModule,
  RouteModules,
} from "./routeModules";
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
  hasClientAction: boolean;
  hasClientLoader: boolean;
  hasErrorBoundary: boolean;
  imports?: string[];
  css?: string[];
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
      Component: getRouteModuleComponent(routeModule),
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
  initialState: HydrationState,
  future: FutureConfig
) {
  return createClientRoutes(
    manifest,
    routeModulesCache,
    initialState,
    future,
    "",
    groupRoutesByParentId(manifest),
    needsRevalidation
  );
}

export function createClientRoutes(
  manifest: RouteManifest<EntryRoute>,
  routeModulesCache: RouteModules,
  initialState: HydrationState,
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

    async function serverLoader({ request }: { request: Request }) {
      // Only prefetch links if we've been loaded into the cache, route.lazy
      // will handle initial loads
      let routeModulePromise = routeModulesCache[route.id]
        ? prefetchStyleLinks(route, routeModulesCache[route.id])
        : Promise.resolve();
      try {
        if (!route.hasLoader) return null;
        return fetchServerHandler(request, route);
      } finally {
        await routeModulePromise;
      }
    }

    function callClientLoader(
      clientLoader: ClientLoaderFunction,
      { request, params }: RRLoaderFunctionArgs
    ) {
      return clientLoader({
        request,
        params,
        serverFetch() {
          if (!route.hasLoader) return null;
          return fetchServerHandler(request, route);
        },
      });
    }

    async function serverAction({ request }: { request: Request }) {
      // Only prefetch links if we've been loaded into the cache, route.lazy
      // will handle initial loads
      let routeModulePromise = routeModulesCache[route.id]
        ? prefetchStyleLinks(route, routeModulesCache[route.id])
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
    }

    function callClientAction(
      clientLoader: ClientActionFunction,
      { request, params }: RRActionFunctionArgs
    ) {
      return clientLoader({
        request,
        params,
        serverFetch() {
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
        },
      });
    }

    let dataRoute: DataRouteObject = {
      id: route.id,
      index: route.index,
      path: route.path,
    };

    if (routeModule) {
      // Use critical path modules directly
      Object.assign(dataRoute, {
        ...dataRoute,
        Component: getRouteModuleComponent(routeModule),
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
      });

      let initialServerFetch: () => Promise<Response | DeferredData>;
      if (initialState?.loaderData?.[route.id]) {
        let initialData = initialState.loaderData[route.id];
        initialServerFetch = async () => {
          // Force an async tick so React can properly render the fallback element
          // and let the router subscriber initialize

          // TODO: This feels suboptimal, but there's no _real_ way for us to
          // know if clientLoaders are synchronous...?  We should try to fix this.
          // The problematic scenario (which is intermittent) is:
          // * Remix calls createBrowserRouter, which starts as state.initialized=false
          // * initialize() calls startNavigation which calls client loaders
          // * RemixBrowser renders RouterProvider
          // * synchronous client loaders finish _before_ the RouterProvider layout effect
          //   wires up the subscriber
          // * So the completeNAvigation and setting state.initialized=true never gets picked up by the React Router layer
          // console.log("sleeping!");
          // await new Promise((r) => setTimeout(r, 10));
          return routerJson(initialData);
        };
      } else {
        initialServerFetch = async () => {
          throw new Error(
            "You are trying to call serverFetch() on a route that does not have a server loader"
          );
        };
      }

      if (routeModule.clientLoader) {
        let clientLoader = routeModule.clientLoader;
        dataRoute.loader = ({ request, params }) => {
          if (request.headers.has("X-Remix-Initial-Load")) {
            return clientLoader({
              request,
              params,
              serverFetch: initialServerFetch,
              initialData,
            });
          } else {
            return callClientLoader(clientLoader, {
              request,
              params,
            });
          }
        };
      } else if (route.hasLoader) {
        dataRoute.loader = ({ request, params }) => {
          if (request.headers.has("X-Remix-Initial-Load")) {
            return initialServerFetch();
          } else {
            return serverLoader({ request });
          }
        };
      }

      // TODO: Action
    } else {
      // Load all other modules via route.lazy()
      Object.assign(dataRoute, {
        ...dataRoute,
        ...(!route.hasClientLoader ? { loader: serverLoader } : {}),
        ...(!route.hasClientAction ? { action: serverAction } : {}),
        lazy: async () => {
          let mod = await loadRouteModuleWithBlockingLinks(
            route,
            routeModulesCache
          );

          let lazyRoute: Partial<DataRouteObject> = { ...mod };
          if (mod.clientLoader) {
            let clientLoader = mod.clientLoader;
            lazyRoute = {
              ...mod,
              loader: ({ request, params }) =>
                callClientLoader(clientLoader, {
                  request,
                  params,
                }),
            };
          }

          if (mod.clientAction) {
            let clientAction = mod.clientAction;
            lazyRoute = {
              ...mod,
              loader: (args) => callClientAction(clientAction, args),
            };
          }

          if (needsRevalidation) {
            lazyRoute.shouldRevalidate = wrapShouldRevalidateForHdr(
              route.id,
              mod.shouldRevalidate,
              needsRevalidation
            );
          }

          return {
            loader: lazyRoute.loader,
            action: lazyRoute.action,
            hasErrorBoundary: lazyRoute.hasErrorBoundary,
            shouldRevalidate: lazyRoute.shouldRevalidate,
            handle: lazyRoute.handle,
            Component: lazyRoute.Component,
            ErrorBoundary: lazyRoute.ErrorBoundary,
          };
        },
      });
    }

    let children = createClientRoutes(
      manifest,
      routeModulesCache,
      initialState,
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
  await prefetchStyleLinks(route, routeModule);

  // Include all `browserSafeRouteExports` fields, except `Fallback` since the
  // root route is always an initial match
  return {
    Component: getRouteModuleComponent(routeModule),
    ErrorBoundary: routeModule.ErrorBoundary,
    clientAction: routeModule.clientAction,
    clientLoader: routeModule.clientLoader,
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

// Our compiler generates the default export as `{}` when no default is provided,
// which can lead us to trying to use that as a Component in RR and calling
// createElement on it.  Patching here as a quick fix and hoping it's no longer
// an issue in Vite.
function getRouteModuleComponent(routeModule: RouteModule) {
  if (routeModule.default == null) return undefined;
  let isEmptyObject =
    typeof routeModule.default === "object" &&
    Object.keys(routeModule.default).length === 0;
  if (!isEmptyObject) {
    return routeModule.default;
  }
}
