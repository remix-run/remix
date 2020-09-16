import type { ReactNode } from "react";
import React from "react";
// TODO: Export RouteObject from 'react-router-dom'
import type { RouteObject } from "react-router";
import { useLocation, useRoutes } from "react-router-dom";
import type {
  RemixEntryContext,
  RouteManifest,
  RouteData
} from "@remix-run/core";

import invariant from "./invariant";

const RemixContext = React.createContext<RemixEntryContext | undefined>(
  undefined
);

function useRemixContext(): RemixEntryContext {
  let context = React.useContext(RemixContext);

  if (!context) {
    // TODO: Nicer error message
    throw new Error("You must render this element in a <Remix> component");
  }

  return context;
}

const RemixCacheContext = React.createContext<DataCache | undefined>(undefined);

export function RemixEntryProvider({
  context,
  children
}: {
  context: RemixEntryContext;
  children: ReactNode;
}) {
  let cache = useDataCache(context.routeData);

  return (
    <RemixContext.Provider value={context}>
      <RemixCacheContext.Provider value={cache}>
        {children}
      </RemixCacheContext.Provider>
    </RemixContext.Provider>
  );
}

interface StaticDataCache {
  read(locationKey: string, routeId: string): RouteData[string];
}

function createStaticDataCache(
  initialKey: string,
  initialData: RouteData
): StaticDataCache {
  let cache: { [locationKey: string]: RouteData } = {
    [initialKey]: initialData
  };

  return {
    read(locationKey: string, routeId: string) {
      let data = cache[locationKey][routeId];

      invariant(
        data,
        `Missing data for route ${routeId} on location ${locationKey}`
      );

      return data;
    }
  };
}

interface DataCache {
  read(routeId: string): ReturnType<StaticDataCache["read"]>;
}

function useDataCache(initialData: RouteData): DataCache {
  let location = useLocation();
  /* let [, forceUpdate] = React.useState(); */

  let cacheRef = React.useRef<StaticDataCache>();
  if (!cacheRef.current) {
    cacheRef.current = createStaticDataCache(location.key, initialData);
  }

  return React.useMemo<DataCache>(
    () => ({
      read: (routeId: string) => cacheRef.current!.read(location.key, routeId)
      /* preload: cacheRef.current.preload, */
      /* readAll: () => cacheRef.current.readAll(location.key), */
      /* getAllSync: () => cacheRef.current.getAllSync(location.key), */
      /* set: (routeId, value) => { */
      /*   cacheRef.current.set(location.key, routeId, value); */
      /*   forceUpdate({}); */
      /* } */
    }),
    [location]
  );
}

const RemixRouteIdContext = React.createContext<string | undefined>(undefined);

export function RemixRoute({ id }: { id: string }) {
  let context = useRemixContext();
  let mod = context.requireRoute(id);

  if (!mod) {
    return (
      <RemixError>
        <RemixRouteMissing id={id} />
      </RemixError>
    );
  }

  return (
    <RemixRouteIdContext.Provider value={id}>
      <mod.default />
    </RemixRouteIdContext.Provider>
  );
}

function RemixError({ children }: { children: ReactNode }) {
  return (
    <div>
      <h1>Error!</h1>
      <div>{children}</div>
    </div>
  );
}

function RemixRouteMissing({ id }: { id: string }) {
  return <p>Missing route "{id}"!</p>;
}

export function useRouteData() {
  let routeId = React.useContext(RemixRouteIdContext);
  invariant(routeId, "Missing route id on context");

  let cache = React.useContext(RemixCacheContext);
  let data = cache!.read(routeId);

  let setData = React.useCallback(
    nextData => {
      /* cache.set(routeId, nextData); */
    },
    [cache, routeId]
  );

  return [data, setData] as const;
}

export function Routes() {
  let context = useRemixContext();
  let routes = createRoutesFromManifest(context.routeManifest);
  return useRoutes(routes);
}

function createRoutesFromManifest(routeManifest: RouteManifest): RouteObject[] {
  let routeIds = Object.keys(routeManifest).sort();
  let routes: RouteObject[] = [];
  let addedRoutes: { [routeId: string]: RouteObject } = {};

  for (let routeId of routeIds) {
    let manifestRoute = routeManifest[routeId];
    let route = {
      caseSensitive: false,
      path: manifestRoute.path,
      element: <RemixRoute id={manifestRoute.id} />,
      preload: () => {
        // TODO
      }
    };

    if (manifestRoute.parentId == null) {
      routes.push(route);
    } else {
      let parentRoute = addedRoutes[manifestRoute.parentId];

      invariant(
        parentRoute,
        `Missing parent route "${manifestRoute.parentId}" for ${manifestRoute.id}`
      );

      (parentRoute.children || (parentRoute.children = [])).push(route);
    }

    addedRoutes[routeId] = route;
  }

  return routes;
}

export function Meta() {
  /* let { meta } = useContext(); */
  return null;
}

export function Scripts() {
  return null;
}

export function Styles() {
  return null;
}

export function Link() {
  return <a href="#">link</a>;
}
