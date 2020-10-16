import type { ReactNode } from "react";
import React from "react";
import type { Action, Location } from "history";
// TODO: Export all react-router types from react-router-dom
import type { RouteObject, Navigator, Params } from "react-router";
import { matchRoutes, Router } from "react-router-dom";
import type {
  EntryContext,
  EntryManifest,
  EntryRouteObject,
  EntryRouteMatch
} from "@remix-run/core";

import type { DataCache } from "./dataCache";
import { createDataCache } from "./dataCache";
import defaultRouteModule from "./defaultRouteModule";
import { patchManifest } from "./manifest";
import type { RouteLoader, RouteManifest } from "./routeModuleCache";
import invariant from "./invariant";

export interface ClientRouteObject {
  caseSensitive?: boolean;
  children?: ClientRouteObject[];
  element: ReactNode;
  id: string;
  path: string;
}

export interface ClientRouteMatch {
  params: Params;
  pathname: string;
  route: ClientRouteObject;
}

export function createClientRoute(
  entryRoute: EntryRouteObject
): ClientRouteObject {
  return {
    caseSensitive: !!entryRoute.caseSensitive,
    id: entryRoute.id,
    path: entryRoute.path,
    element: <RemixRoute id={entryRoute.id} />
  };
}

export function createClientRoutes(
  routeManifest: RouteManifest<EntryRouteObject>
): ClientRouteObject[] {
  let routes: ClientRouteObject[] = [];
  let addedRoutes: { [routeId: string]: ClientRouteObject } = {};

  let routeIds = Object.keys(routeManifest).sort();
  for (let routeId of routeIds) {
    let entryRoute = routeManifest[routeId];
    let route = createClientRoute(entryRoute);

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

function matchClientRoutes(
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

export function createClientMatches(
  matches: EntryRouteMatch[]
): ClientRouteMatch[] {
  return matches.map(match => ({
    ...match,
    route: createClientRoute(match.route)
  }));
}

///////////////////////////////////////////////////////////////////////////////

function useLazyRef<T>(init: () => T): T {
  let ref = React.useRef<T | undefined>();
  if (ref.current === undefined) ref.current = init();
  return ref.current;
}

interface RemixEntryContextType {
  dataCache: DataCache;
  globalDataState: ReturnType<typeof React.useState>;
  manifest: EntryManifest;
  matches: ClientRouteMatch[];
  pending: boolean; // TODO: Move into RR v6
  publicPath: string;
  routeLoader: RouteLoader;
  serverHandoffString?: string;
}

const RemixEntryContext = React.createContext<
  RemixEntryContextType | undefined
>(undefined);

export function useRemixEntryContext(): RemixEntryContextType {
  let context = React.useContext(RemixEntryContext);
  invariant(context, "You must render this element inside a <Remix> element");
  return context;
}

export function RemixEntry({
  children,
  context: entryContext,
  action: nextAction,
  location: nextLocation,
  navigator,
  static: staticProp = false
}: {
  children: ReactNode;
  context: EntryContext;
  action: Action;
  location: Location;
  navigator: Navigator;
  static?: boolean;
}) {
  let {
    globalData,
    manifest: entryManifest,
    matches: entryMatches,
    publicPath,
    routeData,
    routeLoader,
    serverHandoffString
  } = entryContext;

  let [state, setState] = React.useState({
    action: nextAction,
    location: nextLocation,
    matches: createClientMatches(entryMatches),
    pending: false
  });
  let { action, location, matches, pending } = state;

  let globalDataState = React.useState(globalData);
  let dataCache = useLazyRef(() => createDataCache(location.key, routeData));
  let manifest = React.useRef(entryManifest).current;

  React.useEffect(() => {
    if (location === nextLocation) return;

    let isCurrent = true;

    setState(state => ({ ...state, pending: true }));

    (async () => {
      await patchManifest(manifest, nextLocation.pathname);

      let routes = createClientRoutes(manifest.routes);
      let nextMatches = matchClientRoutes(routes, nextLocation);

      let dataPromise = dataCache.preload(
        location,
        nextLocation,
        matches,
        nextMatches
      );

      let stylesheetsPromise = loadStylesheets(
        nextMatches,
        manifest,
        publicPath
      );

      await Promise.all(
        nextMatches.map(match =>
          routeLoader.preload(manifest.assets, match.route.id)
        )
      );

      await dataPromise;
      await stylesheetsPromise;

      if (isCurrent) {
        setState({
          action: nextAction,
          location: nextLocation,
          matches: nextMatches,
          pending: false
        });
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [nextAction, nextLocation, location, matches, publicPath]);

  let context = {
    dataCache,
    globalDataState,
    manifest,
    matches,
    pending, // TODO: Move into RR v6
    publicPath,
    routeLoader,
    serverHandoffString
  };

  return (
    <Router
      action={action}
      location={location}
      navigator={navigator}
      static={staticProp}
    >
      <RemixEntryContext.Provider value={context}>
        {children}
      </RemixEntryContext.Provider>
    </Router>
  );
}

////////////////////////////////////////////////////////////////////////////////

interface RemixRouteContextType {
  id: string;
}

const RemixRouteContext = React.createContext<
  RemixRouteContextType | undefined
>(undefined);

export function useRemixRouteContext(): RemixRouteContextType {
  let context = React.useContext(RemixRouteContext);
  invariant(context, "You must render this element in a remix route element");
  return context;
}

export function RemixRoute({ id }: { id: string }) {
  let { routeLoader } = useRemixEntryContext();
  let routeModule = routeLoader.read(id);

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
// Without this we have a flash of unstyled content when the css takes longer to
// load than the rest of the transition (manifest, data, modules). While our
// <Styles> component does the actual rendering of these stylesheets, this
// imperatively loads and waits for the resources before allowing the transition
// to move on. When the <Styles> component renders these same URLs, the browser
// should use the cache and avoid FOUC.
//
// This implementation expects long cache-control on css resources because when
// the transition completes, these links have been removed and the <Styles> tag
// adds new ones with the same href. If max-age isn't at least a few seconds
// then the browser will go get a 304 from the server. Which is probably still
// fine, but it'd be better if max-age was one year. Since our build hashes
// these filenames, and all of our deployment wrappers have good static asset
// handling, we can expect max-age of one year, so there shouldn't be any
// FOUC in production.
function loadStylesheets(
  matches: ClientRouteMatch[],
  manifest: EntryManifest,
  publicPath: string
) {
  let hrefs = [];
  for (let match of matches) {
    let key = `${match.route.id}.css`;
    if (manifest.assets[key]) {
      hrefs.push(publicPath + manifest.assets[key].fileName);
    }
  }

  function loadStyleSheet(href: string) {
    return new Promise(resolve => {
      let link = document.createElement("link");

      // setting to "print" prevents these styles from applying before the
      // transition is complete (or ever ... really)
      link.media = "print";
      link.rel = "stylesheet";
      link.type = "text/css";
      link.href = href;

      link.onload = () => {
        document.head.removeChild(link);
        resolve();
      };

      // have to append to get it to actually load
      document.head.appendChild(link);
    });
  }

  return Promise.all(hrefs.map(loadStyleSheet));
}
