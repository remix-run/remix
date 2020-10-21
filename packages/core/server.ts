import type { AssetManifest } from "./build";
import {
  getAssetManifest,
  getServerManifest,
  getServerEntryModule,
  getRouteModules,
  getDevAssetManifest
} from "./build";
import { getCacheDir } from "./cache";
import { writeDevServerBuild } from "./compiler";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
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
import type { ConfigRouteObject, ConfigRouteMatch } from "./match";
import { matchRoutes } from "./match";
import type { Request } from "./platform";
import { Headers, Response } from "./platform";
import { purgeRequireCache } from "./requireCache";
import type { RouteManifest } from "./routes";
import { oneYear } from "./seconds";

const PROD = process.env.NODE_ENV === "production";
const TEST = process.env.NODE_ENV === "test";
const DEV = !(PROD || TEST);

/**
 * The main request handler for a Remix server. This handler runs in the context
 * of a cloud provider's server (e.g. Express on Firebase) or locally via their
 * dev tools.
 *
 * The server picks `development` or `production` mode based on the value of
 * `process.env.NODE_ENV`. In production, the server reads the build from disk.
 * In development, it re-evaluates the config and all app modules on every
 * request and dynamically generates the build for only the modules needed to
 * serve it.
 */
export interface RequestHandler {
  (request: Request, loadContext?: AppLoadContext): Promise<Response>;
}

/**
 * Creates a HTTP request handler.
 */
export function createRequestHandler(remixRoot?: string): RequestHandler {
  let configPromise = readConfig(remixRoot);

  return async (req, loadContext = {}) => {
    if (DEV) {
      let config = await configPromise;
      purgeRequireCache(config.rootDirectory);
      configPromise = readConfig(remixRoot);
    }

    let config = await configPromise;
    let url = new URL(req.url);

    if (url.pathname.startsWith("/__remix_data")) {
      return handleDataRequest(config, req, loadContext);
    }

    if (url.pathname.startsWith("/__remix_manifest")) {
      return handleManifestRequest(config, req);
    }

    return handleHtmlRequest(config, req, loadContext);
  };
}

async function handleDataRequest(
  config: RemixConfig,
  req: Request,
  loadContext: AppLoadContext
): Promise<Response> {
  let searchParams = new URL(req.url).searchParams;
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
    config,
    routeId,
    params,
    loadContext,
    url
  );

  if (!loadResult) {
    return json(null);
  }

  return loadResult;
}

async function handleManifestRequest(config: RemixConfig, req: Request) {
  let searchParams = new URL(req.url).searchParams;
  let urlParam = searchParams.get("url");

  if (!urlParam) {
    return jsonError(`Missing ?url`, 403);
  }

  let url = new URL(urlParam);
  let matches = matchRoutes(config.routes, url.pathname);

  if (!matches) {
    return jsonError(`No routes matched path "${url.pathname}"`, 404);
  }

  let assetManifest: AssetManifest;
  if (DEV) {
    adjustDevConfig(config, matches);

    try {
      assetManifest = await getDevAssetManifest(config.publicPath);
    } catch (error) {
      console.error(error);
      console.error(
        `Unable to fetch the asset manifest. Are you running \`remix run\`?`
      );

      return jsonError(`Unable to fetch asset manifest`, 500);
    }
  } else {
    assetManifest = getAssetManifest(config.serverBuildDirectory);
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

  return new Response(JSON.stringify(entryManifest), {
    headers: {
      "Cache-Control": `public, max-age=${oneYear}`,
      "Content-Type": "application/json",
      ETag: entryManifest.version
    }
  });
}

async function handleHtmlRequest(
  config: RemixConfig,
  req: Request,
  loadContext: AppLoadContext
): Promise<Response> {
  let url = new URL(req.url);

  let statusCode = 200;
  let matches = matchRoutes(config.routes, url.pathname);

  function handleDataLoadError(error: any) {
    if (!TEST) {
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
  let globalLoadResultPromise = loadGlobalData(config, loadContext, url);
  let routeLoadResultPromises = matches.map(match =>
    loadRouteData(config, match.route.id, match.params, loadContext, url)
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

  let serverBuildDirectory: string;
  let assetManifest: AssetManifest;
  if (DEV) {
    adjustDevConfig(config, matches);

    serverBuildDirectory = getCacheDir(config.rootDirectory, "build");

    await writeDevServerBuild(config, serverBuildDirectory);

    try {
      assetManifest = await getDevAssetManifest(config.publicPath);
    } catch (error) {
      // The dev server is not running.
      // TODO: Show a nice error page.
      throw error;
    }
  } else {
    serverBuildDirectory = config.serverBuildDirectory;
    assetManifest = getAssetManifest(serverBuildDirectory);
  }

  let serverManifest = getServerManifest(serverBuildDirectory);
  let serverEntryModule = getServerEntryModule(
    serverBuildDirectory,
    serverManifest
  );
  let routeModules = getRouteModules(
    serverBuildDirectory,
    config.routeManifest,
    serverManifest
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
    publicPath: config.publicPath,
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
          new Headers(routeHeaders).forEach(pair => {
            parentsHeaders.set(...pair);
          });
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
    req,
    statusCode,
    headers,
    serverEntryContext
  );
}

function adjustDevConfig(config: RemixConfig, matches: ConfigRouteMatch[]) {
  // Modify routes and routeManifest so they contain only the matched routes.
  // This speeds up the build considerably.
  config.routes = matches.reduceRight((children, match) => {
    let route = { ...match.route };
    if (children.length) route.children = children;
    return [route];
  }, [] as ConfigRouteObject[]);

  config.routeManifest = matches.reduce((routeManifest, match) => {
    let { children, ...route } = match.route;
    routeManifest[route.id] = route;
    return routeManifest;
  }, {} as RouteManifest);

  // Modify publicPath to point to the dev server.
  config.publicPath =
    process.env.REMIX_RUN_ORIGIN || `http://localhost:${config.devServerPort}/`;
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

////////////////////////////////////////////////////////////////////////////////

function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function jsonError(error: string, status = 403) {
  return json({ error }, status);
}
