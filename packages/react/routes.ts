import type { ComponentType, ReactNode } from "react";
import React from "react";
import type { Location } from "history";
import type { Params, RouteObject } from "react-router";
import { matchRoutes } from "react-router-dom";
import type {
  EntryRouteObject,
  EntryRouteMatch,
  RouteManifest
} from "@remix-run/core";

import invariant from "./invariant";

export interface ClientRouteObject {
  caseSensitive?: boolean;
  children?: ClientRouteObject[];
  element: ReactNode;
  id: string;
  path: string;
}

type RouteComponentType = ComponentType<{ id: string }>;

export function createClientRoute(
  entryRoute: EntryRouteObject,
  elementType: RouteComponentType
): ClientRouteObject {
  return {
    caseSensitive: !!entryRoute.caseSensitive,
    id: entryRoute.id,
    path: entryRoute.path,
    element: React.createElement(elementType, {
      id: entryRoute.id
    })
  };
}

export function createClientRoutes(
  routeManifest: RouteManifest<EntryRouteObject>,
  elementType: RouteComponentType
): ClientRouteObject[] {
  let routes: ClientRouteObject[] = [];
  let addedRoutes: { [routeId: string]: ClientRouteObject } = {};

  let routeIds = Object.keys(routeManifest).sort();
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
  route: ClientRouteObject;
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
  routes: ClientRouteObject[],
  location: Location
): ClientRouteMatch[] {
  let matches = matchRoutes((routes as unknown) as RouteObject[], location);

  invariant(matches, "Missing matches");

  return matches.map(match => ({
    params: match.params,
    pathname: match.pathname,
    route: (match.route as unknown) as ClientRouteObject
  }));
}
