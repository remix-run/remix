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
import { Headers, Request, Response, fetch } from "./fetch";
import type { ConfigRouteObject, ConfigRouteMatch } from "./match";
import { matchRoutes } from "./match";
import { json, jsonError } from "./responseHelpers";
import type { RouteManifest } from "./routes";
import { oneYear } from "./seconds";

// TODO: Put this in entry.ts
function createEntryLookup(
  publicPath: string,
  manifestEntries: AssetManifest["entries"],
  manifestKeys: string[]
): EntryManifest["modules"] {
  return manifestKeys.reduce((memo, key) => {
    let entry = manifestEntries[key];

    if (entry) {
      memo[key] = publicPath + entry.file;
    }

    return memo;
  }, {} as { [key: string]: string });
}

function createEntryLoaders(matches: ConfigRouteMatch[]) {
  return matches.reduce((memo, match) => {
    let routeId = match.route.id;

    if (match.route.loaderFile) {
      memo[routeId] = `/_remix/data`;
    }

    return memo;
  }, {} as EntryManifest["loaders"]);
}

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
  serverMode: string = ServerMode.Production
): RequestHandler {
  if (
    serverMode !== ServerMode.Development &&
    serverMode !== ServerMode.Production &&
    serverMode !== ServerMode.Test
  ) {
    serverMode = ServerMode.Production;
  }

  return async (request, loadContext = {}) => {
    let url = new URL(request.url);

    if (url.pathname.startsWith("/_remix/data")) {
      return handleDataRequest(remixConfig, request, loadContext);
    }

    if (url.pathname.startsWith("/_remix/manifest")) {
      return handleManifestRequest(remixConfig, request, serverMode);
    }

    return handleDocumentRequest(remixConfig, request, loadContext, serverMode);
  };
}

async function handleDataRequest(
  remixConfig: RemixConfig,
  request: Request,
  loadContext: AppLoadContext
): Promise<Response> {
  let isAction = isActionRequest(request);
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
  let loaderRequest = createLoaderRequest(url.href, request);
  let loadResult = await loadRouteData(
    remixConfig.loadersDirectory,
    remixConfig.routeManifest[routeId],
    params,
    loadContext,
    loaderRequest,
    isAction
  );

  if (!loadResult) {
    return json(null);
  }

  if (isRedirect(loadResult)) {
    return new Response("", {
      status: 204,
      headers: {
        "x-remix-redirect": loadResult.headers.get("location")!
      }
    });
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

  let publicPath: string;
  let assetManifest: AssetManifest;
  if (serverMode === ServerMode.Development) {
    publicPath = getDevPublicPath(remixConfig);
    let devAssetManifestPromise = getDevAssetManifest(publicPath);

    try {
      assetManifest = await devAssetManifestPromise;
    } catch (error) {
      return jsonError(`Unable to fetch asset manifest`, 500);
    }
  } else {
    publicPath = remixConfig.publicPath;
    assetManifest = getAssetManifest(remixConfig.serverBuildDirectory);
  }

  let entryManifest: EntryManifest = {
    routes: createRouteManifest(matches),
    modules: createEntryLookup(
      publicPath,
      assetManifest.entries,
      matches.map(match => match.route.id)
    ),
    loaders: createEntryLoaders(matches),
    styles: createEntryLookup(
      publicPath,
      assetManifest.entries,
      matches.map(match => `${match.route.id}.css`)
    ),
    version: assetManifest.version
  };

  return json(entryManifest, {
    headers: {
      "Cache-Control": `public, max-age=${oneYear}`,
      ETag: entryManifest.version
    }
  });
}

async function handleDocumentRequest(
  remixConfig: RemixConfig,
  request: Request,
  loadContext: AppLoadContext,
  serverMode: string
): Promise<Response> {
  let isAction = isActionRequest(request);
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

  if (isAction) {
    let leafMatch = matches[matches.length - 1];
    let result = await loadRouteData(
      remixConfig.loadersDirectory,
      remixConfig.routeManifest[leafMatch.route.id],
      leafMatch.params,
      loadContext,
      request,
      isAction
    );
    return result!;
  }

  // Run all data loaders in parallel and await them individually below.
  let globalLoadResultPromise = loadGlobalData(
    remixConfig.loadersDirectory,
    loadContext,
    request
  );
  let routeLoadResultPromises = matches.map(match =>
    loadRouteData(
      remixConfig.loadersDirectory,
      remixConfig.routeManifest[match.route.id],
      match.params,
      loadContext,
      request,
      isAction
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
  let redirectResult = allResults.find(result => result && isRedirect(result));

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

  let entryManifest: EntryManifest = {
    routes: createRouteManifest(matches),
    modules: createEntryLookup(
      publicPath,
      assetManifest.entries,
      ["entry-browser"].concat(matches.map(match => match.route.id))
    ),
    loaders: createEntryLoaders(matches),
    styles: createEntryLookup(
      publicPath,
      assetManifest.entries,
      ["global.css"].concat(matches.map(match => `${match.route.id}.css`))
    ),
    version: assetManifest.version
  };
  let serverHandoff: ServerHandoff = {
    globalData,
    manifest: entryManifest,
    matches: entryMatches,
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

function isRedirect(response: Response) {
  return (
    response.status === 301 ||
    response.status === 302 ||
    response.status === 303
  );
}

function createLoaderRequest(url: string, request: Request) {
  return new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
}

function isActionRequest(request: Request) {
  return request.method.toLowerCase() !== "get";
}
