import type { ReactNode } from "react";
import React from "react";
// TODO: Export RouteObject from 'react-router-dom'
import type { RouteObject, RouteMatch } from "react-router";
import {
  useLocation,
  useRoutes,
  useResolvedPath,
  Link as ReactRouterLink,
  matchRoutes
} from "react-router-dom";
import type { EntryContext } from "@remix-run/core";

import * as defaultRouteModule from "./defaultRouteModule";
import type { DataCache } from "./dataCache";
import { createDataCache } from "./dataCache";
import type { ManifestCache } from "./manifestCache";
import { createManifestCache } from "./manifestCache";
import type { RouteLoader } from "./routeModuleCache";
import invariant from "./invariant";
import createHtml from "./createHtml";

function useLazyRef<T>(initFn: () => T): T {
  let ref = React.useRef<T | undefined>();
  if (ref.current === undefined) ref.current = initFn();
  return ref.current;
}

////////////////////////////////////////////////////////////////////////////////

// TODO: RR should not be calling preload on the server because you
// can't actually suspend on the server.
let canUseDom = typeof window === "object";

function createRoutes(
  pathname: string,
  manifestCache: ManifestCache,
  routeLoader: RouteLoader
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
  globalDataState: ReturnType<typeof React.useState>;
  manifestCache: ManifestCache;
  publicPath: string;
  routeLoader: RouteLoader;
}

const RemixEntryContext = React.createContext<
  RemixEntryContextType | undefined
>(undefined);

function useRemixEntryContext(): RemixEntryContextType {
  let context = React.useContext(RemixEntryContext);
  invariant(context, "You must render this element in a <Remix> component");
  return context;
}

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
    globalData,
    publicPath,
    routeData,
    routeLoader,
    routeManifest
  } = entryContext;

  let location = useLocation();
  let dataCache = useLazyRef(() => createDataCache(location.key, routeData));
  let manifestCache = useLazyRef(() =>
    createManifestCache(location.pathname, browserManifest, routeManifest)
  );
  let globalDataState = React.useState(globalData);

  let [previousLocation, setPreviousLocation] = React.useState(location);
  if (previousLocation !== location) {
    dataCache.preload(location, previousLocation);
    setPreviousLocation(location);
  }

  let remixEntryContext = {
    browserEntryContextString,
    dataCache,
    globalDataState,
    manifestCache,
    publicPath,
    routeLoader
  };

  return (
    <RemixEntryContext.Provider value={remixEntryContext}>
      {children}
    </RemixEntryContext.Provider>
  );
}

////////////////////////////////////////////////////////////////////////////////

interface RemixRouteContextType {
  id: string;
}

const RemixRouteContext = React.createContext<
  RemixRouteContextType | undefined
>(undefined);

function useRemixRouteContext(): RemixRouteContextType {
  let context = React.useContext(RemixRouteContext);
  invariant(context, "You must render this element in a remix route element");
  return context;
}

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

  let remixRouteContext = { id };

  return (
    <RemixRouteContext.Provider value={remixRouteContext}>
      <routeModule.default />
    </RemixRouteContext.Provider>
  );
}

function RemixRouteMissing({ id }: { id: string }) {
  return <p>Missing route "{id}"!</p>;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Renders the `<title>` and `<meta>` tags for the current routes.
 */
export function Meta() {
  return (
    <React.Suspense fallback={null}>
      <AsyncMeta />
    </React.Suspense>
  );
}

function AsyncMeta() {
  let { dataCache, manifestCache, routeLoader } = useRemixEntryContext();
  let location = useLocation();
  let matches = useMatches();

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

/**
 * Renders the scripts needed for the initial render of this page. Additional
 * scripts are loaded later as needed.
 */
export function Scripts() {
  let {
    browserEntryContextString,
    manifestCache,
    publicPath
  } = useRemixEntryContext();

  let initialLocation = React.useRef(useLocation()).current;
  let manifest = manifestCache.read(initialLocation.pathname);
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

/**
 * Renders the styles needed for the current routes.
 */
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

/**
 * Renders the routes for this page. Suspends if we don't yet have the manifest
 * or routes for this page and need to get them from the server.
 */
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

/**
 * Renders a <a> element for navigating around the site.
 */
export function Link(props: any) {
  let { manifestCache } = useRemixEntryContext();

  let resolvedPath = useResolvedPath(props.to);

  React.useEffect(() => {
    manifestCache.preload(resolvedPath.pathname);
  }, [resolvedPath]);

  return <ReactRouterLink {...props} />;
}

/**
 * Returns the data from `data/global.js`.
 */
export function useGlobalData() {
  let { globalDataState } = useRemixEntryContext();
  return globalDataState;
}

/**
 * Returns the data for the current route from `data/routes/*`.
 */
export function useRouteData() {
  let { dataCache } = useRemixEntryContext();
  let { id: routeId } = useRemixRouteContext();
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
