import type { AssetManifest } from "./build";
import {
  AssetManifestFilename,
  getAssetManifest,
  getServerManifest,
  getServerEntryModule,
  getRouteModules
} from "./build";
import { getCacheDir } from "./cache";
import { writeDevServerBuild } from "./compiler";
import type { RemixConfig } from "./config";
import type { AppLoadContext, AppLoadResult } from "./data";
import { loadGlobalData, loadRouteData } from "./data";
import type { EntryManifest, ServerHandoff } from "./entry";
import {
  createEntryMatches,
  createGlobalData,
  createRouteData,
  createRouteManifest,
  createServerHandoffString
} from "./entry";
import type { Request } from "./fetch";
import { Headers, Response, fetch } from "./fetch";
import type { ConfigRouteObject, ConfigRouteMatch } from "./match";
import { matchRoutes } from "./match";
import { json, jsonError } from "./responseHelpers";
import type { RouteManifest } from "./routes";
import { oneYear } from "./seconds";

/**
 * The mode to use when running the server.
 */
export enum ServerMode {
  Development = "development",
  Production = "production",
  Test = "test"
}

/**
 * The main request handler for a Remix server. This handler runs in the context
 * of a cloud provider's server (e.g. Express on Firebase) or locally via their
 * dev tools.
 */
export interface RequestHandler {
  (request: Request, loadContext?: AppLoadContext): Promise<Response>;
}

/**
 * Creates a handler (aka "server") that serves HTTP requests from the app in the
 * given `remixRoot`.
 *
 * In production mode, the server reads the build from disk. In development, it
 * dynamically generates the build at request time for only the modules needed
 * to serve that request.
 */
export function createRequestHandler(
  remixConfig: RemixConfig,
  serverMode: string = ServerMode.Development
): RequestHandler {
  return async (request, loadContext = {}) => {
    let url = new URL(request.url);

    if (url.pathname.startsWith("/_remix/data")) {
      return handleDataRequest(remixConfig, request, loadContext);
    }

    if (url.pathname.startsWith("/_remix/manifest")) {
      return handleManifestRequest(remixConfig, request, serverMode);
    }

    return handleHtmlRequest(remixConfig, request, loadContext, serverMode);
  };
}

async function handleDataRequest(
  remixConfig: RemixConfig,
  request: Request,
  loadContext: AppLoadContext
): Promise<Response> {
  let searchParams = new URL(request.url).searchParams;
  let urlParam = searchParams.get("url");
  let routeId = searchParams.get("id");
  let params = JSON.parse(searchParams.get("params") || "{}");

  if (!urlParam) {
    return jsonError(`Missing ?url`, 403);
  }
  if (!routeId) {
    return jsonError(`Missing ?id`, 403);
  }

  let url = new URL(urlParam);
  let loadResult = await loadRouteData(
    remixConfig.loadersDirectory,
    remixConfig.routeManifest[routeId],
    params,
    loadContext,
    url
  );

  if (!loadResult) {
    return json(null);
  }

  return loadResult;
}

async function handleManifestRequest(
  remixConfig: RemixConfig,
  request: Request,
  serverMode: string
): Promise<Response> {
  let searchParams = new URL(request.url).searchParams;
  let urlParam = searchParams.get("url");

  if (!urlParam) {
    return jsonError(`Missing ?url`, 403);
  }

  let url = new URL(urlParam);
  let matches = matchRoutes(remixConfig.routes, url.pathname);

  if (!matches) {
    return jsonError(`No routes matched path "${url.pathname}"`, 404);
  }

  let assetManifest: AssetManifest;
  if (serverMode === ServerMode.Development) {
    let devAssetManifestPromise = getDevAssetManifest(
      getDevPublicPath(remixConfig)
    );

    try {
      assetManifest = await devAssetManifestPromise;
    } catch (error) {
      return jsonError(`Unable to fetch asset manifest`, 500);
    }
  } else {
    assetManifest = getAssetManifest(remixConfig.serverBuildDirectory);
  }

  // Get the manifest for only the matched routes.
  let matchedAssetKeys = [
    ...matches.map(match => match.route.id),
    ...matches.map(match => `${match.route.id}.css`)
  ];

  let entryManifest: EntryManifest = {
    assets: getPartialEntries(assetManifest.entries, matchedAssetKeys),
    routes: createRouteManifest(matches),
    version: assetManifest.version
  };

  return json(entryManifest, {
    headers: {
      "Cache-Control": `public, max-age=${oneYear}`,
      ETag: entryManifest.version
    }
  });
}

async function handleHtmlRequest(
  remixConfig: RemixConfig,
  request: Request,
  loadContext: AppLoadContext,
  serverMode: string
): Promise<Response> {
  let url = new URL(request.url);

  let statusCode = 200;
  let matches = matchRoutes(remixConfig.routes, url.pathname);

  function handleDataLoadError(error: any) {
    if (serverMode !== ServerMode.Test) {
      console.error(error);
    }

    statusCode = 500;
    matches = [
      {
        params: { error },
        pathname: url.pathname,
        route: {
          id: "routes/500",
          path: url.pathname,
          componentFile: "routes/500.js"
        }
      }
    ];
  }

  if (!matches) {
    statusCode = 404;
    matches = [
      {
        params: {},
        pathname: url.pathname,
        route: {
          id: "routes/404",
          path: url.pathname,
          componentFile: "routes/404.js"
        }
      }
    ];
  }

  // Run all data loaders in parallel and await them individually below.
  let globalLoadResultPromise = loadGlobalData(
    remixConfig.loadersDirectory,
    loadContext,
    url
  );
  let routeLoadResultPromises = matches.map(match =>
    loadRouteData(
      remixConfig.loadersDirectory,
      remixConfig.routeManifest[match.route.id],
      match.params,
      loadContext,
      url
    )
  );

  let globalLoadResult: AppLoadResult = null;
  try {
    globalLoadResult = await globalLoadResultPromise;
  } catch (error) {
    console.error(`There was an error running the global data loader`);
  }

  let routeLoadResults: AppLoadResult[] = [];
  for (let promise of routeLoadResultPromises) {
    try {
      routeLoadResults.push(await promise);
    } catch (error) {
      let match = matches[routeLoadResults.length];
      console.error(
        `There was an error running the data loader for route ${match.route.id}`
      );
      routeLoadResults.push(null);
      handleDataLoadError(error);
    }
  }

  let allResults = [globalLoadResult, ...routeLoadResults];

  // Check for redirect. A redirect in a loader takes precedence over all
  // other responses and is immediately returned.
  let redirectResult = allResults.find(
    result => result && (result.status === 301 || result.status === 302)
  );

  if (redirectResult) {
    return redirectResult;
  }

  // Check for a result with a non-200 status code. The first loader with a
  // non-200 status code determines the status code for the whole response.
  let notOkResult = allResults.find(result => result && result.status !== 200);

  if (notOkResult) {
    statusCode = notOkResult.status;
  }

  let publicPath: string;
  let serverBuildDirectory: string;
  let assetManifest: AssetManifest;
  if (serverMode === ServerMode.Development) {
    publicPath = getDevPublicPath(remixConfig);
    serverBuildDirectory = getCacheDir(remixConfig.rootDirectory, "build");

    let devAssetManifestPromise = getDevAssetManifest(publicPath);
    let devServerBuildPromise = writeDevServerBuild(
      getDevConfigForMatches(remixConfig, matches),
      serverBuildDirectory
    );

    try {
      assetManifest = await devAssetManifestPromise;
    } catch (error) {
      // TODO: Show a nice error page.
      throw error;
    }

    await devServerBuildPromise;
  } else {
    publicPath = remixConfig.publicPath;
    serverBuildDirectory = remixConfig.serverBuildDirectory;
    assetManifest = getAssetManifest(serverBuildDirectory);
  }

  let serverManifest = getServerManifest(serverBuildDirectory);
  let serverEntryModule = getServerEntryModule(
    serverBuildDirectory,
    serverManifest
  );
  let routeModules = getRouteModules(
    serverBuildDirectory,
    serverManifest,
    matches.map(match => match.route.id)
  );

  let entryMatches = createEntryMatches(matches);
  let globalData = await createGlobalData(globalLoadResult);
  let routeData = await createRouteData(routeLoadResults, matches);

  // Get the asset manifest for only the browser entry point + the matched
  // routes. The client will fill in the rest by making requests to the manifest
  // endpoint as needed.
  let matchedAssetKeys = [
    "entry-browser",
    "global.css",
    ...matches.map(match => match.route.id),
    ...matches.map(match => `${match.route.id}.css`)
  ];

  let entryManifest: EntryManifest = {
    assets: getPartialEntries(assetManifest.entries, matchedAssetKeys),
    routes: createRouteManifest(matches),
    version: assetManifest.version
  };
  let serverHandoff: ServerHandoff = {
    globalData,
    manifest: entryManifest,
    matches: entryMatches,
    publicPath: publicPath,
    routeData
  };
  let serverEntryContext = {
    ...serverHandoff,
    routeModules,
    serverHandoffString: createServerHandoffString(serverHandoff)
  };

  // Calculate response headers from the matched routes.
  let headers = matches.reduce((parentsHeaders, match, index) => {
    let routeId = match.route.id;
    let routeModule = routeModules[routeId];

    if (typeof routeModule.headers === "function") {
      try {
        let loadResult = routeLoadResults[index];
        let loaderHeaders = loadResult ? loadResult.headers : new Headers();
        let routeHeaders = routeModule.headers({
          loaderHeaders,
          parentsHeaders
        });

        if (routeHeaders) {
          for (let [key, value] of new Headers(routeHeaders).entries()) {
            parentsHeaders.set(key, value);
          }
        }
      } catch (error) {
        console.error(
          `There was an error getting headers for route ${routeId}`
        );
        console.error(error);
      }
    }

    return parentsHeaders;
  }, new Headers());

  return serverEntryModule.default(
    request,
    statusCode,
    headers,
    serverEntryContext
  );
}

function getDevConfigForMatches(
  remixConfig: RemixConfig,
  matches: ConfigRouteMatch[]
): RemixConfig {
  return {
    ...remixConfig,

    // Modify routes and routeManifest so they contain only the matched routes.
    // This speeds up the build considerably.
    routes: matches.reduceRight((children, match) => {
      let route = { ...match.route };
      if (children.length) route.children = children;
      return [route];
    }, [] as ConfigRouteObject[]),

    routeManifest: matches.reduce((routeManifest, match) => {
      let { children, ...route } = match.route;
      routeManifest[route.id] = route;
      return routeManifest;
    }, {} as RouteManifest)
  };
}

function getDevPublicPath(remixConfig: RemixConfig): string {
  return addTrailingSlash(
    process.env.REMIX_RUN_ORIGIN ||
      `http://localhost:${remixConfig.devServerPort}/`
  );
}

function addTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : path + "/";
}

export async function getDevAssetManifest(
  remixRunOrigin: string
): Promise<AssetManifest> {
  try {
    let res = await fetch(remixRunOrigin + AssetManifestFilename);
    return res.json();
  } catch (error) {
    console.error(error);
    console.error(
      `Unable to fetch the asset manifest. Are you running \`remix run\`?`
    );

    throw error;
  }
}

function getPartialEntries<T = any>(
  entries: { [key: string]: T },
  keys: string[]
): { [key: string]: T } {
  return keys.reduce((memo, key) => {
    if (key in entries) memo[key] = entries[key];
    return memo;
  }, {} as { [key: string]: T });
}
