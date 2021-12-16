import type { ComponentType, ReactNode } from "react";
import React from "react";
import type { Params } from "react-router";

import type { RouteModules, ShouldReloadFunction } from "./routeModules";
import { loadRouteModule } from "./routeModules";
import {
  extractData,
  fetchData,
  isCatchResponse,
  isRedirectResponse
} from "./data";
import type { Submission } from "./transition";
import { CatchValue, TransitionRedirect } from "./transition";
import { prefetchStyleLinks } from "./links";
import invariant from "./invariant";

export interface RouteManifest<Route> {
  [routeId: string]: Route;
}

// NOTE: make sure to change the Route in server-runtime if you change this
interface Route {
  caseSensitive?: boolean;
  id: string;
  path?: string;
  index?: boolean;
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

export type RouteDataFunction = {
  (args: {
    /**
     * Parsed params from the route path
     */
    params: Params;

    /**
     * The url to be loaded, resolved to the matched route.
     */
    url: URL; // resolved route

    /**
     * Will be present if being called from `<Form>` or `useSubmit`
     */
    submission?: Submission;

    /**
     * Attach this signal to fetch (or whatever else) to abort your
     * implementation when a load/action is aborted.
     */
    signal: AbortSignal;
  }): Promise<any> | any;
};

export interface ClientRoute extends Route {
  loader?: RouteDataFunction;
  action?: RouteDataFunction;
  shouldReload?: ShouldReloadFunction;
  ErrorBoundary?: any;
  CatchBoundary?: any;
  children?: ClientRoute[];
  element: ReactNode;
  module: string;
  hasLoader: boolean;
}

type RemixRouteComponentType = ComponentType<{ id: string }>;

export function createClientRoute(
  entryRoute: EntryRoute,
  routeModulesCache: RouteModules,
  Component: RemixRouteComponentType
): ClientRoute {
  return {
    caseSensitive: !!entryRoute.caseSensitive,
    element: <Component id={entryRoute.id} />,
    id: entryRoute.id,
    path: entryRoute.path,
    index: entryRoute.index,
    module: entryRoute.module,
    loader: createLoader(entryRoute, routeModulesCache),
    action: createAction(entryRoute),
    shouldReload: createShouldReload(entryRoute, routeModulesCache),
    ErrorBoundary: entryRoute.hasErrorBoundary,
    CatchBoundary: entryRoute.hasCatchBoundary,
    hasLoader: entryRoute.hasLoader
  };
}

export function createClientRoutes(
  routeManifest: RouteManifest<EntryRoute>,
  routeModulesCache: RouteModules,
  Component: RemixRouteComponentType,
  parentId?: string
): ClientRoute[] {
  return Object.keys(routeManifest)
    .filter(key => routeManifest[key].parentId === parentId)
    .map(key => {
      let route = createClientRoute(
        routeManifest[key],
        routeModulesCache,
        Component
      );
      let children = createClientRoutes(
        routeManifest,
        routeModulesCache,
        Component,
        route.id
      );
      if (children.length > 0) route.children = children;
      return route;
    });
}

function createShouldReload(route: EntryRoute, routeModules: RouteModules) {
  let shouldReload: ShouldReloadFunction = arg => {
    let module = routeModules[route.id];
    invariant(module, `Expected route module to be loaded for ${route.id}`);
    if (module.unstable_shouldReload) {
      return module.unstable_shouldReload(arg);
    }
    return true;
  };

  return shouldReload;
}

async function loadRouteModuleWithBlockingLinks(
  route: EntryRoute,
  routeModules: RouteModules
) {
  let routeModule = await loadRouteModule(route, routeModules);
  await prefetchStyleLinks(routeModule);
  return routeModule;
}

function createLoader(route: EntryRoute, routeModules: RouteModules) {
  let loader: ClientRoute["loader"] = async ({ url, signal, submission }) => {
    if (route.hasLoader) {
      let [result] = await Promise.all([
        fetchData(url, route.id, signal, submission),
        loadRouteModuleWithBlockingLinks(route, routeModules)
      ]);

      if (result instanceof Error) throw result;

      let redirect = await checkRedirect(result);
      if (redirect) return redirect;

      if (isCatchResponse(result)) {
        throw new CatchValue(
          result.status,
          result.statusText,
          await extractData(result.clone())
        );
      }

      return extractData(result);
    } else {
      await loadRouteModuleWithBlockingLinks(route, routeModules);
    }
  };

  return loader;
}

function createAction(route: EntryRoute) {
  if (!route.hasAction) return undefined;

  let action: ClientRoute["action"] = async ({ url, signal, submission }) => {
    let result = await fetchData(url, route.id, signal, submission);

    if (result instanceof Error) {
      throw result;
    }

    let redirect = await checkRedirect(result);
    if (redirect) return redirect;

    if (isCatchResponse(result)) {
      throw new CatchValue(
        result.status,
        result.statusText,
        await extractData(result.clone())
      );
    }

    return extractData(result);
  };

  return action;
}

async function checkRedirect(
  response: Response
): Promise<null | TransitionRedirect> {
  if (isRedirectResponse(response)) {
    let url = new URL(
      response.headers.get("X-Remix-Redirect")!,
      window.location.origin
    );

    if (url.origin !== window.location.origin) {
      await new Promise(() => {
        window.location.replace(url.href);
      });
    } else {
      return new TransitionRedirect(url.pathname + url.search);
    }
  }

  return null;
}
