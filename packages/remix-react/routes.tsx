import type { ComponentType, ReactNode } from "react";
import type { Location } from "history";
import React from "react";

import type { RouteMatch } from "./routeMatching";
import type { RouteModules } from "./routeModules";
import { loadRouteModule } from "./routeModules";
import { extractData, fetchData, isRedirectResponse } from "./data";
import { TransitionRedirect } from "./transition";
import { preloadBlockingLinks } from "./linksPreloading";

export interface RouteManifest<Route> {
  [routeId: string]: Route;
}

interface Route {
  caseSensitive?: boolean;
  id: string;
  path: string;
}

export interface EntryRoute extends Route {
  hasAction: boolean;
  hasLoader: boolean;
  hasErrorBoundary: boolean;
  imports?: string[];
  module: string;
  parentId?: string;
}

export interface ClientRoute extends Route {
  loader?: ({
    match,
    location,
    signal
  }: {
    match: RouteMatch<ClientRoute>;
    location: Location<any>;
    signal: AbortSignal;
  }) => Promise<any> | any;
  action?: ({
    match,
    location,
    signal
  }: {
    match: RouteMatch<ClientRoute>;
    location: Location<any>;
    signal: AbortSignal;
  }) => Promise<any> | any;
  shouldReload?: ({
    nextLocation,
    prevLocation,
    nextMatch,
    prevMatch
  }: {
    nextLocation: Location<any>;
    prevLocation: Location<any>;
    nextMatch: RouteMatch<ClientRoute>;
    prevMatch: RouteMatch<ClientRoute>;
  }) => boolean;
  ErrorBoundary?: any;
  children?: ClientRoute[];
  element: ReactNode;
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
    loader: createLoader(entryRoute, routeModulesCache),
    action: createAction(entryRoute),
    ErrorBoundary: entryRoute.hasErrorBoundary
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

function createLoader(route: EntryRoute, routeModules: RouteModules) {
  let loader: ClientRoute["loader"] = async ({ location, signal }) => {
    if (!route.hasLoader) {
      let routeModule = await loadRouteModule(route, routeModules);
      if (routeModule.links) await preloadBlockingLinks(routeModule);
      return;
    }

    let [result, routeModule] = await Promise.all([
      fetchData(location, route.id, "get", signal),
      loadRouteModule(route, routeModules)
    ]);

    if (result instanceof Error) {
      if (routeModule.links) await preloadBlockingLinks(routeModule);
      throw result;
    }

    let redirect = await checkRedirect(result);
    if (redirect) return redirect;

    let data = extractData(result);
    if (routeModule.links) await preloadBlockingLinks(routeModule, data);
    return data;
  };

  return loader;
}

function createAction(route: EntryRoute) {
  if (!route.hasAction) return undefined;

  let action: ClientRoute["action"] = async ({ location, signal }) => {
    let result = await fetchData(location, route.id, "post", signal);

    if (result instanceof Error) throw result;

    let redirect = await checkRedirect(result);
    if (redirect) return redirect;

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
