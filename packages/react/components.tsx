import type { Action, Location } from "history";
import type { ReactNode } from "react";
import React from "react";
import type { Navigator } from "react-router";
import { Router, Link, useLocation, useRoutes } from "react-router-dom";
import type { EntryContext } from "@remix-run/core";

import type { AppData, RouteData } from "./data";
import { loadRouteData } from "./data";
import defaultRouteModule from "./defaultRouteModule";
import invariant from "./invariant";
import type { Manifest } from "./manifest";
import { loadManifest } from "./manifest";
import { createHtml } from "./markup";
import type { RouteModules } from "./routeModules";
import { loadRouteModule } from "./routeModules";
import type { ClientRouteMatch } from "./routes";
import {
  createClientRoutes,
  createClientMatches,
  matchClientRoutes
} from "./routes";
import { loadRouteStyleSheet } from "./stylesheets";

////////////////////////////////////////////////////////////////////////////////
// RemixEntry

interface RemixEntryContextType {
  globalData: AppData;
  manifest: Manifest;
  matches: ClientRouteMatch[];
  pending: boolean;
  publicPath: string;
  routeData: RouteData;
  routeModules: RouteModules;
  serverHandoffString?: string;
}

const RemixEntryContext = React.createContext<
  RemixEntryContextType | undefined
>(undefined);

function useRemixEntryContext(): RemixEntryContextType {
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
    manifest,
    matches: entryMatches,
    publicPath,
    routeData: entryRouteData,
    routeModules,
    serverHandoffString
  } = entryContext;

  let [state, setState] = React.useState({
    action: nextAction,
    location: nextLocation,
    matches: createClientMatches(entryMatches, RemixRoute),
    pending: false,
    routeData: entryRouteData
  });
  let { action, location, matches, pending, routeData } = state;

  React.useEffect(() => {
    if (location === nextLocation) return;

    let isCurrent = true;

    setState(state => ({ ...state, pending: true }));

    (async () => {
      await loadManifest(manifest, nextLocation.pathname);

      let routes = createClientRoutes(manifest.routes, RemixRoute);
      let nextMatches = matchClientRoutes(routes, nextLocation);

      let dataPromise = Promise.all(
        nextMatches.map((match, index) =>
          location.search === nextLocation.search &&
          matches[index] &&
          matches[index].pathname === match.pathname
            ? // Re-use data we already have for routes already on the page.
              routeData[match.route.id]
            : loadRouteData(manifest, location, match.params, match.route.id)
        )
      );

      let styleSheetsPromise = Promise.all(
        nextMatches.map(match =>
          loadRouteStyleSheet(manifest, publicPath, match.route.id)
        )
      );

      let modulesPromise = Promise.all(
        nextMatches.map(match =>
          loadRouteModule(manifest, publicPath, match.route.id, routeModules)
        )
      );

      let dataResults = await dataPromise;
      await styleSheetsPromise;
      await modulesPromise;

      if (isCurrent) {
        let nextRouteData = nextMatches.reduce((routeData, match, index) => {
          routeData[match.route.id] = dataResults[index];
          return routeData;
        }, {} as RouteData);

        setState({
          action: nextAction,
          location: nextLocation,
          matches: nextMatches,
          pending: false,
          routeData: nextRouteData
        });
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [nextAction, nextLocation, location, matches, publicPath, routeData]);

  let context: RemixEntryContextType = {
    globalData,
    manifest,
    matches,
    pending,
    publicPath,
    routeData,
    routeModules,
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
// RemixRoute

interface RemixRouteContextType {
  data: AppData;
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

export function RemixRoute({ id: routeId }: { id: string }) {
  let { routeData, routeModules } = useRemixEntryContext();

  let data = routeData[routeId];
  let routeModule = routeModules[routeId];

  if (!routeModule) {
    return (
      <defaultRouteModule.default>
        <RemixRouteMissing id={routeId} />
      </defaultRouteModule.default>
    );
  }

  let context: RemixRouteContextType = {
    data,
    id: routeId
  };

  return (
    <RemixRouteContext.Provider value={context}>
      <routeModule.default />
    </RemixRouteContext.Provider>
  );
}

function RemixRouteMissing({ id: routeId }: { id: string }) {
  return <p>Missing route "{routeId}"!</p>;
}

////////////////////////////////////////////////////////////////////////////////
// Public API

export { Link };

/**
 * Renders the `<title>` and `<meta>` tags for the current routes.
 */
export function Meta() {
  let { matches, routeData, routeModules } = useRemixEntryContext();
  let location = useLocation();

  let meta: { [name: string]: string } = {};
  let parentsData: { [routeId: string]: AppData } = {};

  for (let match of matches) {
    let routeId = match.route.id;
    let data = routeData[routeId];
    let params = match.params;

    let routeModule = routeModules[routeId] || defaultRouteModule;

    if (typeof routeModule.meta === "function") {
      let routeMeta = routeModule.meta({ data, parentsData, params, location });
      Object.assign(meta, routeMeta);
    }

    parentsData[routeId] = data;
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
 * Renders the <script> tags needed for the initial render of this page.
 * Bundles for additional routes are loaded later as needed.
 */
export function Scripts() {
  let { manifest, publicPath, serverHandoffString } = useRemixEntryContext();

  let browserIsHydrating = false;
  if (!serverHandoffString) {
    browserIsHydrating = true;
    serverHandoffString = "{}";
  }

  let contextScript = `window.__remixContext = ${serverHandoffString};`;

  let routeIds = Object.keys(manifest.routes).filter(
    routeId => routeId in manifest.assets
  );
  let contextRouteModulesScript = `${routeIds
    .map(
      (routeId, index) =>
        `import * as route${index} from ${JSON.stringify(
          publicPath + manifest.assets[routeId].file
        )};`
    )
    .join("\n")}
    window.__remixContext.routeModules = {${routeIds
      .map((routeId, index) => `${JSON.stringify(routeId)}:route${index}`)
      .join(",")}};`;

  let entryBrowser = manifest.assets["entry-browser"];

  return React.useMemo(
    () => (
      <>
        <script
          suppressHydrationWarning={browserIsHydrating}
          dangerouslySetInnerHTML={createHtml(contextScript)}
        />
        <script
          dangerouslySetInnerHTML={createHtml(contextRouteModulesScript)}
          type="module"
        />
        <script src={publicPath + entryBrowser.file} type="module" />
      </>
    ),
    []
  );
}

/**
 * Renders the <link> tags for the stylesheets of the current routes.
 */
export function Styles() {
  let { manifest, matches, publicPath } = useRemixEntryContext();

  let styleFiles = [manifest.assets["global.css"].file];

  for (let match of matches) {
    let key = `${match.route.id}.css`;
    if (manifest.assets[key]) {
      styleFiles.push(manifest.assets[key].file);
    }
  }

  return (
    <>
      {styleFiles.map(file => (
        <link key={file} rel="stylesheet" href={publicPath + file} />
      ))}
    </>
  );
}

/**
 * Renders the routes for this page. Suspends if we don't yet have the manifest
 * or routes for this page and need to get them from the server.
 */
export function Routes() {
  // TODO: Add `renderMatches` function to RR that we
  // can use here with the matches we get from context.
  let { manifest } = useRemixEntryContext();
  let routes = createClientRoutes(manifest.routes, RemixRoute);
  return useRoutes(routes);
}

/**
 * Returns the data from `data/global.js`.
 */
export function useGlobalData<T = AppData>(): T {
  return useRemixEntryContext().globalData;
}

/**
 * Returns the data for the current route from `data/routes/*`.
 */
export function useRouteData<T = AppData>(): T {
  return useRemixRouteContext().data;
}

/**
 * Returns `true` if a location change is pending. This is useful for showing
 * a "loading..." indicator during route transitions.
 *
 * TODO: Move this hook back into RR v6 beta (out of experimental)
 */
export function useLocationPending(): boolean {
  return useRemixEntryContext().pending;
}

/**
 * Setup a callback to be fired on the window's `beforeunload` event. This is
 * useful for saving some data to `window.localStorage` just before the page
 * refreshes, which automatically happens on the next `<Link>` click when Remix
 * detects a new version of the app is available on the server.
 *
 * Note: The `callback` argument should be a function created with
 * `React.useCallback()`.
 */
export function useBeforeUnload(callback: () => any): void {
  React.useEffect(() => {
    window.addEventListener("beforeunload", callback);

    return () => {
      window.removeEventListener("beforeunload", callback);
    };
  }, [callback]);
}
