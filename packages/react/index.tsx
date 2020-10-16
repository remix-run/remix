import React from "react";
import {
  useLocation,
  useRoutes,
  Link as ReactRouterLink
} from "react-router-dom";

import createHtml from "./createHtml";
import * as defaultRouteModule from "./defaultRouteModule";
import {
  createClientRoutes,
  useRemixEntryContext,
  useRemixRouteContext
} from "./internals";

/**
 * Renders the `<title>` and `<meta>` tags for the current routes.
 */
export function Meta() {
  let { dataCache, routeLoader, matches } = useRemixEntryContext();
  let location = useLocation();

  let routeData = dataCache.read(location.key);
  if (!routeData) return null;

  let meta: { [name: string]: string } = {};
  let parentsData = {};

  for (let match of matches) {
    let routeId = match.route.id;
    let data = routeData[routeId];
    let params = match.params;

    let routeModule = routeLoader.read(routeId) || defaultRouteModule;

    if (typeof routeModule.meta === "function") {
      Object.assign(
        meta,
        routeModule.meta({ data, parentsData, params, location })
      );
      Object.assign(parentsData, { [routeId]: data });
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
 * Renders the <script> tags needed for the initial render of this page.
 * Additional scripts are loaded later as needed.
 */
export function Scripts() {
  let { manifest, publicPath, serverHandoffString } = useRemixEntryContext();

  let browserIsHydrating = false;
  if (!serverHandoffString) {
    browserIsHydrating = true;
    serverHandoffString = "{}";
  }

  let remixServerHandoff = `window.__remixServerHandoff = ${serverHandoffString};`;

  let routeIds = Object.keys(manifest.routes).filter(
    routeId => routeId in manifest.assets
  );
  let remixRoutes = `${routeIds
    .map(
      (routeId, index) =>
        `import * as route${index} from ${JSON.stringify(
          publicPath + manifest.assets[routeId].fileName
        )};`
    )
    .join("\n")}
    window.__remixRoutes = {${routeIds
      .map((routeId, index) => `${JSON.stringify(routeId)}:route${index}`)
      .join(",")}};`;

  let entryBrowser = manifest.assets["entry-browser"];

  return React.useMemo(
    () => (
      <>
        <script
          suppressHydrationWarning={browserIsHydrating}
          dangerouslySetInnerHTML={createHtml(remixServerHandoff)}
        />
        <script
          dangerouslySetInnerHTML={createHtml(remixRoutes)}
          type="module"
        />
        <script src={publicPath + entryBrowser.fileName} type="module" />
      </>
    ),
    []
  );
}

/**
 * Renders the styles needed for the current routes.
 */
export function Styles() {
  let { manifest, matches, publicPath } = useRemixEntryContext();

  let styleFiles = [manifest.assets["global.css"].fileName];

  for (let match of matches) {
    let key = `${match.route.id}.css`;
    if (manifest.assets[key]) {
      styleFiles.push(manifest.assets[key].fileName);
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
  // TODO: Add `renderMatches` function to RR that we
  // can use here with the matches we get from context.
  let { manifest } = useRemixEntryContext();
  let routes = createClientRoutes(manifest.routes);
  return useRoutes(routes);
}

/**
 * Renders a <a> element for navigating around the site.
 */
export function Link(props: any) {
  // TODO: Detect build version change and do a full page refresh on the next
  // link click.
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
export function useBeforeUnload(callback: () => any) {
  React.useEffect(() => {
    window.addEventListener("beforeunload", callback);

    return () => {
      window.removeEventListener("beforeunload", callback);
    };
  }, [callback]);
}
