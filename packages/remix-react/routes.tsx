import * as React from "react";
import type { HydrationState } from "@remix-run/router";
import { UNSAFE_ErrorResponseImpl as ErrorResponse } from "@remix-run/router";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  DataRouteObject,
  ShouldRevalidateFunction,
} from "react-router-dom";
import { redirect, useRouteError } from "react-router-dom";

import type { RouteModule, RouteModules } from "./routeModules";
import { loadRouteModule } from "./routeModules";
import {
  fetchData,
  isCatchResponse,
  isDeferredData,
  isDeferredResponse,
  isRedirectResponse,
  isResponse,
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
      Fallback: routeModule.Fallback,
      ErrorBoundary: routeModule.ErrorBoundary
        ? routeModule.ErrorBoundary
        : route.id === "root"
        ? () => <RemixRootDefaultErrorBoundary error={useRouteError()} />
        : undefined,
      id: route.id,
      index: route.index,
      path: route.path,
      handle: routeModules[route.id].handle,
      // For partial hydration rendering, we need to indicate when the route
      // has a loader, but it won't ever be called during the static render, so
      // just give it a no-op function so we can render down to the proper fallback
      loader: route.hasLoader ? () => null : undefined,
      // We don't need action/shouldRevalidate on these routes since they're
      // for a static render
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
    let routeModule = routeModulesCache[route.id];

    async function fetchServerLoader(request: Request) {
      if (!route.hasLoader) return null;
      return fetchServerHandler(request, route);
    }

    async function fetchServerAction(request: Request) {
      if (!route.hasAction) {
        let msg =
          `Route "${route.id}" does not have an action, but you are trying ` +
          `to submit to it. To fix this, please add an \`action\` function to the route`;
        console.error(msg);
        throw new ErrorResponse(
          405,
          "Method Not Allowed",
          new Error(msg),
          true
        );
      }

      return fetchServerHandler(request, route);
    }

    async function callServerHandler(
      request: Request,
      handler: () => Promise<unknown>
    ) {
      // Only prefetch links if we've been loaded into the cache, route.lazy
      // will handle initial loads
      let linkPrefetchPromise = routeModulesCache[route.id]
        ? prefetchStyleLinks(route, routeModulesCache[route.id])
        : Promise.resolve();
      try {
        return handler();
      } finally {
        await linkPrefetchPromise;
      }
    }

    let dataRoute: DataRouteObject = {
      id: route.id,
      index: route.index,
      path: route.path,
      action: ({ request }: ActionFunctionArgs) =>
        callServerHandler(request, () => fetchServerAction(request)),
    };

    if (routeModule) {
      // Use critical path modules directly
      Object.assign(dataRoute, {
        ...dataRoute,
        Component: getRouteModuleComponent(routeModule),
        Fallback: routeModule.Fallback,
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

      dataRoute.loader = ({ request, params }: LoaderFunctionArgs) => {
        return callServerHandler(request, async () => {
          if (!routeModule.clientLoader) {
            // Call the server when no client loader exists
            return fetchServerLoader(request);
          }

          let initialData =
            initialState &&
            initialState.loaderData &&
            initialState.loaderData[route.id];

          if (routeModule.Fallback) {
            // If a critical route module has a clientLoader and a Fallback,
            // then we SSR'd the Fallback and we need to ensure we let it hydrate.
            // If the clientLoader is synchronous, then it'll resolve and we'll
            // try to hydrate a rendered Component on top of a SSR'd Fallback.
            // This also ensure's we delay the initialization state update until
            // after the layoutEffect has registered the subscriber.
            // TODO: This is a hack :/
            await new Promise((r) => setTimeout(r, 10));
          }

          return routeModule.clientLoader({
            request,
            params,
            async serverLoader() {
              // Call the server loader for client-side navigations
              if (!request.headers.has("X-Remix-Initial-Load")) {
                let result = await fetchServerLoader(request);
                let unwrapped = await unwrapServerResponse(result);
                return unwrapped;
              }

              // Throw an error if a clientLoader tries to call a serverLoader that doesn't exist
              if (initialData === undefined) {
                throw new Error(
                  "You are trying to call serverFetch() on a route that does not have a server loader"
                );
              }

              // Otherwise, resolve the hydration clientLoader with the pre-loaded server data
              return initialData;
            },
          });
        });
      };
    } else {
      if (!route.hasClientLoader) {
        dataRoute.loader = ({ request }: LoaderFunctionArgs) =>
          callServerHandler(request, () => fetchServerLoader(request));
      }

      // Load all other modules via route.lazy()
      dataRoute.lazy = async () => {
        let mod = await loadRouteModuleWithBlockingLinks(
          route,
          routeModulesCache
        );

        let lazyRoute: Partial<DataRouteObject> = { ...mod };
        if (mod.clientLoader) {
          let clientLoader = mod.clientLoader;
          lazyRoute.loader = (args) =>
            clientLoader({
              ...args,
              serverLoader: () =>
                fetchServerLoader(args.request).then((res) =>
                  unwrapServerResponse(res)
                ),
            });
        }

        if (needsRevalidation) {
          lazyRoute.shouldRevalidate = wrapShouldRevalidateForHdr(
            route.id,
            mod.shouldRevalidate,
            needsRevalidation
          );
        }

        return {
          ...(lazyRoute.loader ? { loader: lazyRoute.loader } : {}),
          hasErrorBoundary: lazyRoute.hasErrorBoundary,
          shouldRevalidate: lazyRoute.shouldRevalidate,
          handle: lazyRoute.handle,
          Component: lazyRoute.Component,
          ErrorBoundary: lazyRoute.ErrorBoundary,
        };
      };
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

  // Include all `browserSafeRouteExports` fields, except `Fallback` since those
  // aren't used on lazily loaded routes
  return {
    Component: getRouteModuleComponent(routeModule),
    ErrorBoundary: routeModule.ErrorBoundary,
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

function unwrapServerResponse(
  result: Awaited<ReturnType<typeof fetchServerHandler>> | null
) {
  if (isDeferredData(result)) {
    return result.data;
  }

  if (isResponse(result)) {
    let contentType = result.headers.get("Content-Type");
    // Check between word boundaries instead of startsWith() due to the last
    // paragraph of https://httpwg.org/specs/rfc9110.html#field.content-type
    if (contentType && /\bapplication\/json\b/.test(contentType)) {
      return result.json();
    } else {
      return result.text();
    }
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
