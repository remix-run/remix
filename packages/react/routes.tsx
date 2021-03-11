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
  elementType: RouteComponentType
): ClientRoute {
  let Component = elementType;
  return {
    path: entryRoute.path,
    caseSensitive: !!entryRoute.caseSensitive,
    id: entryRoute.id,
    element: <Component id={entryRoute.id} />
  };
}

export function createClientRoutes(
  routeManifest: RouteManifest<EntryRoute>,
  elementType: RouteComponentType
): ClientRoute[] {
  let routes: ClientRoute[] = [];
  let addedRoutes: { [routeId: string]: ClientRoute } = {};

  let routeIds = Object.keys(routeManifest).sort(a =>
    // need to put "root" first so it sorts first, this is a bit of hack that
    // will need to be revisted when we support multiple root layouts
    a === "root" ? -1 : 0
  );

  for (let routeId of routeIds) {
    let entryRoute = routeManifest[routeId];
    let route = createClientRoute(entryRoute, elementType);

    if (entryRoute.parentId) {
      let parentRoute = addedRoutes[entryRoute.parentId];

      invariant(
        parentRoute,
        `Missing parent route "${entryRoute.parentId}" for ${entryRoute.id}`
      );

      (parentRoute.children || (parentRoute.children = [])).push(route);
    } else {
      routes.push(route);
    }

    addedRoutes[routeId] = route;
  }

  return routes;
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
