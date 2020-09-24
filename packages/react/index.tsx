import type { ReactNode } from "react";
import React from "react";
// TODO: Export Location from 'react-router'
import type { Location } from "history";
// TODO: Export RouteObject from 'react-router-dom'
import type { RouteObject, RouteMatch } from "react-router";
import {
  useLocation,
  useRoutes,
  useResolvedPath,
  Link as ReactRouterLink,
  matchRoutes
} from "react-router-dom";
import type {
  BuildManifest,
  EntryContext,
  RouteData,
  RouteDataResults,
  RouteManifest
} from "@remix-run/core";

import * as defaultRouteModule from "./defaultRouteModule";
import invariant from "./invariant";
import createHtml from "./createHtml";

function useBetterRef<T>(initFunc: () => T) {
  let ref = React.useRef<T | null>(null);
  if (ref.current == null) ref.current = initFunc();
  return ref.current!;
}

////////////////////////////////////////////////////////////////////////////////

interface DataCache {
  preload(location: Location, fromLocation: Location): Promise<void>;
  read(locationKey: string, routeId?: string): RouteData[string];
}

function createDataCache(
  initialKey: string,
  initialData: RouteData
): DataCache {
  let cache: { [locationKey: string]: RouteData } = {
    [initialKey]: initialData
  };

  let inflight: {
    [locationKey: string]: Promise<RouteData>;
  } = {};

  async function preload(
    location: Location,
    fromLocation: Location
  ): Promise<void> {
    if (cache[location.key]) return;

    if (inflight[location.key]) return;

    inflight[location.key] = fetchDataResults(
      location.pathname,
      fromLocation?.pathname
    );

    try {
      let dataResults = await inflight[location.key];

      cache[location.key] = Object.keys(dataResults).reduce((memo, routeId) => {
        let dataResult = dataResults[routeId];

        if (dataResult.type === "data") {
          memo[routeId] = dataResult.data;
        } else if (dataResult.type === "copy") {
          invariant(
            fromLocation,
            `Cannot get a copy result with no fromLocation`
          );

          memo[routeId] = cache[fromLocation.key][routeId];
        }

        return memo;
      }, {} as RouteData);
    } catch (error) {
      // TODO: Handle errors
      console.error(error);
    } finally {
      delete inflight[location.key];
    }
  }

  function read(locationKey: string, routeId?: string) {
    if (inflight[locationKey]) {
      throw inflight[locationKey];
    }

    let locationData = cache[locationKey];

    invariant(locationData, `Missing data for location ${locationKey}`);

    if (!routeId) return locationData;

    invariant(
      locationData[routeId],
      `Missing data for route ${routeId} on location ${locationKey}`
    );

    return locationData[routeId];
  }

  return { preload, read };
}

async function fetchDataResults(
  path: string,
  from?: string
): Promise<RouteDataResults> {
  let url = `/__remix_data?path=${path}`;
  if (from) url += `&from=${from}`;
  let res = await fetch(url);
  return await res.json();
}

////////////////////////////////////////////////////////////////////////////////

interface Manifest {
  assets: BuildManifest;
  routes: RouteManifest;
}

interface ManifestCache {
  preload(pathname: string): Promise<ManifestPatch | null>;
  read(pathname: string): Manifest;
}

interface ManifestPatch {
  buildManifest: BuildManifest;
  routeManifest: RouteManifest;
}

function createManifestCache(
  initialPathname: string,
  initialAssets: BuildManifest,
  initialRoutes: RouteManifest
): ManifestCache {
  let patchCache: { [pathname: string]: ManifestPatch | null } = {
    [initialPathname]: {
      buildManifest: initialAssets,
      routeManifest: initialRoutes
    }
  };

  let cache = {
    assets: initialAssets,
    routes: initialRoutes
  };

  async function preload(pathname: string) {
    if (patchCache[pathname]) {
      return patchCache[pathname];
    }

    let patch = await fetchManifestPatch(pathname);
    patchCache[pathname] = patch;

    if (patch) {
      Object.assign(cache.assets, patch.buildManifest);
      Object.assign(cache.routes, patch.routeManifest);
    }

    return patch;
  }

  async function preloadOrReload(pathname: string) {
    let patch = await preload(pathname);

    if (patch == null) {
      // Never resolve so suspense will not try to rerender this
      // page before the reload.
      return new Promise(() => {
        window.location.reload();
      });
    }
  }

  function read(pathname: string) {
    if (!(pathname in patchCache)) throw preloadOrReload(pathname);
    return cache;
  }

  return { preload, read };
}

async function fetchManifestPatch(path: string): Promise<ManifestPatch | null> {
  let res = await fetch(`/__remix_manifest?path=${path}`);
  if (res.status === 404) return null;
  return await res.json();
}

////////////////////////////////////////////////////////////////////////////////

// TODO: RR should not be calling preload on the server because you
// can't actually suspend on the server.
let canUseDom = typeof window === "object";

function createRoutes(
  pathname: string,
  manifestCache: ManifestCache,
  routeLoader: EntryContext["routeLoader"]
): RouteObject[] {
  let manifest = manifestCache.read(pathname);
  let routeIds = Object.keys(manifest.routes).sort();
  let routes: RouteObject[] = [];
  let addedRoutes: { [routeId: string]: RouteObject } = {};

  for (let routeId of routeIds) {
    let manifestRoute = manifest.routes[routeId];
    let route = {
      id: routeId,
      // TODO: Make this optional in RR
      caseSensitive: false,
      path: manifestRoute.path,
      element: <RemixRoute id={routeId} />,
      preload() {
        if (canUseDom) {
          routeLoader.preload(manifest.assets, routeId);
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

// This is just a stopgap for now because we need the matches in 3 places:
// <Meta>, <Styles>, and <Routes>. We would do this in <RemixEntry>, but then we
// would need a suspense boundary around the HTML document. Eventually React
// will let us suspend indefinitely, at which point we can move this logic up
// the tree and share the matches with all 3 components.
// See https://github.com/facebook/react/commit/8da0da0937af154b775b243c9d28b6aa50db696b
function useMatches(): RouteMatch[] {
  let { manifestCache, routeLoader } = useRemixEntryContext();
  let location = useLocation();

  // TODO: Add `renderMatches` to RR so we can manually match and render manually
  // on the client (do our own `useRoutes`)
  let routes = createRoutes(location.pathname, manifestCache, routeLoader);
  let matches = matchRoutes(routes, location);

  invariant(matches, "Missing matches");

  return matches;
}

///////////////////////////////////////////////////////////////////////////////

interface RemixEntryContextType {
  browserEntryContextString?: string;
  dataCache: DataCache;
  manifestCache: ManifestCache;
  publicPath: string;
  routeLoader: EntryContext["routeLoader"];
}

const RemixEntryContext = React.createContext<
  RemixEntryContextType | undefined
>(undefined);

export function RemixEntry({
  context: entryContext,
  children
}: {
  context: EntryContext;
  children: ReactNode;
}) {
  let {
    browserEntryContextString,
    browserManifest,
    publicPath,
    routeData,
    routeLoader,
    routeManifest
  } = entryContext;

  let location = useLocation();
  let dataCache = useBetterRef(() => createDataCache(location.key, routeData));
  let manifestCache = useBetterRef(() =>
    createManifestCache(location.pathname, browserManifest, routeManifest)
  );

  let [previousLocation, setPreviousLocation] = React.useState(location);
  if (previousLocation !== location) {
    dataCache.preload(location, previousLocation);
    setPreviousLocation(location);
  }

  let remixContext = {
    browserEntryContextString,
    dataCache,
    manifestCache,
    publicPath,
    routeLoader
  };

  return (
    <RemixEntryContext.Provider value={remixContext}>
      {children}
    </RemixEntryContext.Provider>
  );
}

function useRemixEntryContext(): RemixEntryContextType {
  let context = React.useContext(RemixEntryContext);
  invariant(context, "You must render this element in a <Remix> component");
  return context;
}

////////////////////////////////////////////////////////////////////////////////

const RemixRouteContext = React.createContext("");

export function RemixRoute({ id }: { id: string }) {
  let { routeLoader, manifestCache } = useRemixEntryContext();
  let location = useLocation();
  let manifest = manifestCache.read(location.pathname);
  let routeModule = routeLoader.read(manifest.assets, id);

  if (!routeModule) {
    return (
      <defaultRouteModule.default>
        <RemixRouteMissing id={id} />
      </defaultRouteModule.default>
    );
  }

  return (
    <RemixRouteContext.Provider value={id}>
      <routeModule.default />
    </RemixRouteContext.Provider>
  );
}

function RemixRouteMissing({ id }: { id: string }) {
  return <p>Missing route "{id}"!</p>;
}

////////////////////////////////////////////////////////////////////////////////

export function Meta() {
  return (
    <React.Suspense fallback={null}>
      <AsyncMeta />
    </React.Suspense>
  );
}

function AsyncMeta() {
  let { dataCache, manifestCache, routeLoader } = useRemixEntryContext();

  let matches = useMatches();
  let location = useLocation();
  let manifest = manifestCache.read(location.pathname);
  let routeData = dataCache.read(location.key);

  if (!routeData) return null;

  let meta: { [name: string]: string } = {};
  let allData = {};

  for (let match of matches) {
    // TODO: Make RouteMatch type more flexible somehow to allow for other
    // properties like `id`?
    // @ts-ignore
    let routeId = match.route.id;
    let data = routeData[routeId];
    let params = match.params;

    let routeModule =
      routeLoader.read(manifest.assets, routeId) || defaultRouteModule;

    if (typeof routeModule.meta === "function") {
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
  let {
    browserEntryContextString,
    manifestCache,
    publicPath
  } = useRemixEntryContext();

  let initialLocationRef = React.useRef(useLocation());
  let manifest = manifestCache.read(initialLocationRef.current.pathname);
  let entryBrowser = manifest.assets["entry-browser"];
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
  return (
    <React.Suspense fallback={null}>
      <AsyncStyles />
    </React.Suspense>
  );
}

function AsyncStyles() {
  let { manifestCache, publicPath } = useRemixEntryContext();

  let matches = useMatches();
  let location = useLocation();
  let manifest = manifestCache.read(location.pathname);

  let styleFiles = [manifest.assets["global.css"].fileName];

  for (let match of matches) {
    // @ts-ignore
    let routeId = match.route.id;
    if (manifest.assets[`style/${routeId}.css`]) {
      styleFiles.push(manifest.assets[`style/${routeId}.css`].fileName);
    }
  }

  return (
    <>
      {styleFiles.map(fileName => (
        <link key={fileName} rel="stylesheet" href={publicPath + fileName} />
      ))}
    </>
  );
}

export function Routes() {
  let { manifestCache, routeLoader } = useRemixEntryContext();
  let location = useLocation();

  // Make sure we have the manifest for the page we are transitioning to.
  manifestCache.read(location.pathname);

  // TODO: Add `renderMatches` function to RR that we can use here with the
  // matches we get from context once we can hoist that logic up higher.
  let routes = createRoutes(location.pathname, manifestCache, routeLoader);
  return useRoutes(routes);
}

export function Link(props: any) {
  let { manifestCache } = useRemixEntryContext();
  let resolvedPath = useResolvedPath(props.to);

  React.useEffect(() => {
    manifestCache.preload(resolvedPath.pathname);
  }, [resolvedPath]);

  return <ReactRouterLink {...props} />;
}

export function useRouteData() {
  let routeId = React.useContext(RemixRouteContext);
  invariant(routeId, "Missing route id on context");

  let { dataCache } = useRemixEntryContext();

  let location = useLocation();
  let data = dataCache.read(location.key, routeId);

  let setData = React.useCallback(
    nextData => {
      /* cache.set(routeId, nextData); */
    },
    [dataCache, routeId]
  );

  return [data, setData] as const;
}
