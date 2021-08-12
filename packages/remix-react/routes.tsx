import type { ComponentType, ReactNode } from "react";
import React from "react";

export interface RouteManifest<Route> {
  [routeId: string]: Route;
}

interface Route {
  caseSensitive?: boolean;
  id: string;
  path: string;
}

export interface EntryRoute extends Route {
  hasAction?: boolean;
  hasLoader?: boolean;
  imports?: string[];
  module: string;
  parentId?: string;
}

export interface ClientRoute extends Route {
  children?: ClientRoute[];
  element: ReactNode;
}

type RemixRouteComponentType = ComponentType<{ id: string }>;

export function createClientRoute(
  entryRoute: EntryRoute,
  Component: RemixRouteComponentType
): ClientRoute {
  return {
    caseSensitive: !!entryRoute.caseSensitive,
    element: <Component id={entryRoute.id} />,
    id: entryRoute.id,
    path: entryRoute.path
  };
}

export function createClientRoutes(
  routeManifest: RouteManifest<EntryRoute>,
  Component: RemixRouteComponentType,
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
