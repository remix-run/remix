import React from "react";
import {
  useLocation,
  useRoutes,
  useResolvedPath,
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
  let {
    manifestCache,
    publicPath,
    serverHandoffString
  } = useRemixEntryContext();

  let manifest = manifestCache.read();
  let entryBrowser = manifest.assets["entry-browser"];
  let src = `${publicPath}${entryBrowser.fileName}`;

  let browserIsHydrating = false;
  if (!serverHandoffString) {
    browserIsHydrating = true;
    serverHandoffString = "{}";
  }

  let remixServerHandoff = `window.__remixServerHandoff = ${serverHandoffString}`;

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
        <script src={src} type="module" />
      </>
    ),
    []
  );
}

/**
 * Renders the styles needed for the current routes.
 */
export function Styles() {
  let { manifestCache, publicPath, matches } = useRemixEntryContext();
  let manifest = manifestCache.read();

  let styleFiles = [manifest.assets["global.css"].fileName];

  for (let match of matches) {
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
  // TODO: Add `renderMatches` function to RR that we
  // can use here with the matches we get from context.
  let { manifestCache } = useRemixEntryContext();
  let routes = createClientRoutes(manifestCache.read().routes);
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

// TODO: Move this back into RR v6 beta (out of experimental)
export function useLocationPending(): boolean {
  return useRemixEntryContext().pending;
}
