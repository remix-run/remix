import type { ComponentType, ReactNode } from "react";
import React from "react";
import type { Location } from "history";
import type { Params, RouteObject } from "react-router";
import { matchRoutes } from "react-router-dom";
import type {
  EntryRoute,
  EntryRouteMatch,
  RouteManifest
} from "@remix-run/node";

import invariant from "./invariant";

export interface ClientRoute {
  path: string;
  caseSensitive?: boolean;
  id: string;
  element: ReactNode;
  children?: ClientRoute[];
}

type RouteComponentType = ComponentType<{ id: string }>;

export function createClientRoute(
  entryRoute: EntryRoute,
  Component: RouteComponentType
): ClientRoute {
  return {
    path: entryRoute.path,
    caseSensitive: !!entryRoute.caseSensitive,
    id: entryRoute.id,
    element: <Component id={entryRoute.id} />
  };
}

export function createClientRoutes(
  routeManifest: RouteManifest<EntryRoute>,
  Component: RouteComponentType,
  parentId?: string
): ClientRoute[] {
  return Object.keys(routeManifest)
    .filter(key => routeManifest[key].parentId === parentId)
    .map(key => {
      let route = createClientRoute(routeManifest[key], Component);
      let children = createClientRoutes(routeManifest, Component, route.id);
      if (children.length > 0) route.children = children;
      return route;
    });
}

export interface ClientRouteMatch {
  params: Params;
  pathname: string;
  route: ClientRoute;
}

export function createClientMatches(
  matches: EntryRouteMatch[],
  elementType: RouteComponentType
): ClientRouteMatch[] {
  return matches.map(match => ({
    ...match,
    route: createClientRoute(match.route, elementType)
  }));
}

export function matchClientRoutes(
  routes: ClientRoute[],
  location: Location | string
): ClientRouteMatch[] {
  let matches = matchRoutes((routes as unknown) as RouteObject[], location);

  invariant(matches, "Missing matches");

  return matches.map(match => ({
    params: match.params,
    pathname: match.pathname,
    route: (match.route as unknown) as ClientRoute
  }));
}
