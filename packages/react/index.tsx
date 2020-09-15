import type { ReactChildren } from "react";
import React from "react";
// TODO: Export RouteObject from 'react-router-dom'
import type { RouteObject } from "react-router";
import { useLocation, useRoutes } from "react-router-dom";
import type {
  RemixServerContext,
  LoaderResultSuccess,
  LoaderResult
} from "@remix-run/core";

import invariant from "./invariant";

interface RemixContextType extends Omit<RemixServerContext, "data"> {
  data: LoaderResultSuccess[];
}

const RemixContext = React.createContext<RemixContextType | undefined>(
  undefined
);

function useRemixContext(): RemixContextType {
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
  context: RemixContextType;
  children: ReactChildren;
}) {
  let { data } = context;
  let cache = useDataCache(data);

  return (
    <RemixContext.Provider value={context}>
      <RemixCacheContext.Provider value={cache}>
        {children}
      </RemixCacheContext.Provider>
    </RemixContext.Provider>
  );
}

interface StaticDataCache {
  read(locationKey: string, routeId: string): LoaderResultSuccess["data"];
}

function createStaticDataCache(
  initialKey: string,
  initialData: LoaderResultSuccess[]
): StaticDataCache {
  let data: Record<string, LoaderResultSuccess[]> = {
    [initialKey]: initialData
  };

  return {
    read(locationKey: string, routeId: string) {
      let result = data[locationKey].find(result => result.routeId === routeId);

      invariant(
        result,
        `Missing data for route ${routeId} on location ${locationKey}`
      );

      return result.data;
    }
  };
}

interface DataCache {
  read(routeId: string): ReturnType<StaticDataCache["read"]>;
}

function useDataCache(initialData: LoaderResultSuccess[]): DataCache {
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
  return (
    <RemixRouteIdContext.Provider value={id}>
      <mod.default />
    </RemixRouteIdContext.Provider>
  );
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

  let route = context.matches.reduceRight<RouteObject | null>(
    (childRoute, match) => {
      // TODO: Make caseSensitive optional in RouteObject type in RR
      let route: RouteObject = {
        caseSensitive: false,
        path: match.route.path,
        element: <RemixRoute id={match.route.id} />,
        preload() {
          // TODO
        }
      };

      if (childRoute) {
        route.children = [childRoute];
      }

      return route;
    },
    null
  );

  return useRoutes([route!]);
}

export function Meta() {
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
