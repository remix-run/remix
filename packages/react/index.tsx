import type { ReactNode } from "react";
import React from "react";
// TODO: Export RouteObject from 'react-router-dom'
import type { RouteObject } from "react-router";
import {
  useLocation,
  useRoutes,
  useResolvedPath,
  Link as ReactRouterLink
} from "react-router-dom";
import type {
  BuildManifest,
  EntryContext,
  RouteData,
  RouteManifest
} from "@remix-run/core";

import * as defaultRouteModule from "./defaultRouteModule";
import invariant from "./invariant";
import createHtml from "./createHtml";

const RemixContext = React.createContext<EntryContext | undefined>(undefined);
const RemixCacheContext = React.createContext<DataCache | undefined>(undefined);
const RemixPatchContext = React.createContext<ManifestPatcher | undefined>(
  undefined
);

interface ManifestPatcher {
  (path: string): void;
}

interface RemixPatch {
  build: BuildManifest;
  routes: RouteManifest;
}

function useRemixContext(): EntryContext {
  let context = React.useContext(RemixContext);

  if (!context) {
    // TODO: Nicer error message
    throw new Error("You must render this element in a <Remix> component");
  }

  return context;
}

export function RemixEntryProvider({
  context,
  children
}: {
  context: EntryContext;
  children: ReactNode;
}) {
  let cache = useDataCache(context.routeData);

  let manifestPatcher = React.useCallback(async (path: Path) => {
    let res = await fetch(`/__remix_patch?path=${path}`);
    let patch = (await res.json()) as RemixPatch;
    Object.assign(context.routeManifest, patch.routes);
    Object.assign(context.browserManifest, patch.build);
  }, []);

  return (
    <RemixContext.Provider value={context}>
      <RemixCacheContext.Provider value={cache}>
        <RemixPatchContext.Provider value={manifestPatcher}>
          {children}
        </RemixPatchContext.Provider>
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
  let mod = context.routeLoader.read(id);

  if (!mod) {
    return (
      <defaultRouteModule.default>
        <RemixRouteMissing id={id} />
      </defaultRouteModule.default>
    );
  }

  return (
    <RemixRouteIdContext.Provider value={id}>
      <mod.default />
    </RemixRouteIdContext.Provider>
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
  let routes = createRoutes(useRemixContext());
  return useRoutes(routes);
}

// TODO: React Router should not be calling preload on the server because you
// can't actually suspend on the server.
let canUseDom = typeof window === "object";

function createRoutes(context: EntryContext): RouteObject[] {
  let routeIds = Object.keys(context.routeManifest).sort();
  let routes: RouteObject[] = [];
  let addedRoutes: { [routeId: string]: RouteObject } = {};

  for (let routeId of routeIds) {
    let manifestRoute = context.routeManifest[routeId];
    let route = {
      caseSensitive: false,
      path: manifestRoute.path,
      element: <RemixRoute id={routeId} />,
      preload() {
        if (canUseDom) {
          context.routeLoader.load(routeId);
          // TODO: cache.preload(location)
        }
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
  return (
    <React.Suspense fallback={null}>
      <AsyncMeta />
    </React.Suspense>
  );
}

function AsyncMeta() {
  let context = useRemixContext();
  let location = useLocation();

  let meta: { [name: string]: string } = {};
  let allData = {};

  for (let routeId of context.matchedRouteIds) {
    let routeModule = context.routeLoader.read(routeId) || defaultRouteModule;

    if (typeof routeModule.meta === "function") {
      let data = context.routeData[routeId];
      let params = context.routeParams[routeId];
      Object.assign(allData, { [routeId]: data });
      Object.assign(
        meta,
        routeModule.meta({ data, params, location, allData })
      );
    }
  }

  return (
    <>
      {Object.keys(meta).map(name =>
        name === "title" ? (
          <title key="title">{meta[name]}</title>
        ) : (
          <meta key={name} name={name} content={meta[name]} />
        )
      )}
    </>
  );
}

export function Scripts() {
  let context = useRemixContext();
  let { browserManifest, publicPath, browserEntryContextString } = context;
  let entryBrowser = browserManifest["__entry_browser__"];
  let src = `${publicPath}${entryBrowser.fileName}`;

  let browserIsHydrating = false;
  if (!browserEntryContextString) {
    browserIsHydrating = true;
    browserEntryContextString = "{}";
  }

  return (
    <>
      <script
        suppressHydrationWarning={browserIsHydrating}
        dangerouslySetInnerHTML={createHtml(
          `__remixContext = ${browserEntryContextString}`
        )}
      />
      <script type="module" src={src} />
    </>
  );
}

export function Styles() {
  return null;
}

export function Link(props: any) {
  let manifestPatcher = React.useContext(RemixPatchContext);
  let resolvedPath = useResolvedPath(props.to);

  React.useEffect(() => {
    manifestPatcher!(resolvedPath.pathname);
  }, [resolvedPath]);

  return <ReactRouterLink {...props} />;
}
