import type { AssetManifest, ServerEntryModule, RouteModules } from "./build";
import {
  getAssetManifest,
  getServerManifest,
  getServerEntryModule,
  getRouteModules,
  getDevAssetManifest,
  getDevServerEntryModule,
  getDevRouteModules
} from "./build";
import { generateDevServerBuild } from "./compiler";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import type { AppLoadContext, AppLoadResult } from "./data";
import { loadGlobalData, loadRouteData } from "./data";
import {
  createEntryMatches,
  createGlobalData,
  createRouteData,
  createRouteLoader,
  createRouteManifest,
  createServerHandoffString
} from "./entry";
import type { ConfigRouteObject, ConfigRouteMatch } from "./match";
import { matchRoutes } from "./match";
import type { Request } from "./platform";
import { Response } from "./platform";
import { purgeRequireCache } from "./requireCache";

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
    if (process.env.NODE_ENV === "development") {
      let config = await configPromise;
      purgeRequireCache(config.rootDirectory);
      configPromise = readConfig(remixRoot);
    }

    let config = await configPromise;
    let url = new URL(req.url);

    if (url.pathname.startsWith("/__remix_manifest")) {
      return handleManifestRequest(config, req);
    }

    if (url.pathname.startsWith("/__remix_data")) {
      return handleDataRequest(config, req, loadContext);
    }

    return handleHtmlRequest(config, req, loadContext);
  };
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
  if (process.env.NODE_ENV === "development") {
    rewritePublicPath(config);

    try {
      assetManifest = await getDevAssetManifest(config.publicPath);
    } catch (error) {
      // The dev server is not running. This is just a manifest patch request, so
      // return an empty patch. We will serve an error page on the HTML request.
      assetManifest = {};
    }
  } else {
    assetManifest = getAssetManifest(config.serverBuildDirectory);
  }

  // Get the browser manifest for only the matched routes.
  let assetManifestKeys = [
    ...matches.map(match => match.route.id),
    ...matches.map(match => `style/${match.route.id}.css`)
  ];
  let partialAssetManifest = getPartialManifest(
    assetManifest,
    assetManifestKeys
  );
  let routeManifest = createRouteManifest(matches);

  return json({ assets: partialAssetManifest, routes: routeManifest });
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

async function handleHtmlRequest(
  config: RemixConfig,
  req: Request,
  loadContext: AppLoadContext
): Promise<Response> {
  let url = new URL(req.url);

  let statusCode = 200;
  let matches = matchRoutes(config.routes, url.pathname);

  function handleDataLoadError(error: any) {
    console.error(error);

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

  let globalLoadResult: AppLoadResult = null;
  let routeLoadResults: AppLoadResult[] = [];

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
  } else {
    // Run all data loaders in parallel.
    let globalLoadResultPromise = loadGlobalData(config, loadContext, url);
    let routeLoadResultPromises = matches.map(match =>
      loadRouteData(config, match.route.id, match.params, loadContext, url)
    );

    try {
      globalLoadResult = await globalLoadResultPromise;
    } catch (error) {
      console.error(`There was an error running the global data loader`);
      handleDataLoadError(error);
    }

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

    // Check for redirect.
    let redirectResult = [globalLoadResult, ...routeLoadResults].find(
      result => result && (result.status === 301 || result.status === 302)
    );

    if (redirectResult) {
      return redirectResult;
    }

    // Check for a result with a non-200 status code.
    let notOkResult = [globalLoadResult, ...routeLoadResults].find(
      result => result && result.status !== 200
    );

    if (notOkResult) {
      statusCode = notOkResult.status;
    }
  }

  let assetManifest: AssetManifest;
  let serverEntryModule: ServerEntryModule;
  let routeModules: RouteModules;
  if (process.env.NODE_ENV === "development") {
    // Adjust `config.routes` so that only the routes that are matched in the
    // current request are available. This should speed up the build since we
    // only build the matched routes.
    rewriteRoutes(config, matches);
    rewritePublicPath(config);

    try {
      assetManifest = await getDevAssetManifest(config.publicPath);
    } catch (error) {
      // The dev server is not running.
      // TODO: Show a nice error page.
      throw error;
    }

    let { output: serverBuildOutput } = await generateDevServerBuild(config);

    serverEntryModule = getDevServerEntryModule(
      config.serverBuildDirectory,
      serverBuildOutput
    );
    routeModules = getDevRouteModules(
      config.serverBuildDirectory,
      config.routes,
      serverBuildOutput
    );
  } else {
    assetManifest = getAssetManifest(config.serverBuildDirectory);

    let serverManifest = getServerManifest(config.serverBuildDirectory);

    serverEntryModule = getServerEntryModule(
      config.serverBuildDirectory,
      serverManifest
    );
    routeModules = getRouteModules(
      config.serverBuildDirectory,
      config.routes,
      serverManifest
    );
  }

  let entryMatches = createEntryMatches(matches);
  let globalData = await createGlobalData(globalLoadResult);
  let routeData = await createRouteData(routeLoadResults, matches);
  let partialRouteManifest = createRouteManifest(matches);

  // Get the browser manifest for only the browser entry point + the matched
  // routes. The client will fill in the rest by making requests to the manifest
  // endpoint as needed.
  let assetManifestKeys = [
    "entry-browser",
    "global.css",
    ...matches.map(match => match.route.id),
    ...matches.map(match => `style/${match.route.id}.css`)
  ];
  let partialAssetManifest = getPartialManifest(
    assetManifest,
    assetManifestKeys
  );

  let serverHandoff = {
    assets: partialAssetManifest,
    globalData,
    matches: entryMatches,
    publicPath: config.publicPath,
    routeData,
    routes: partialRouteManifest
  };

  let serverEntryContext = {
    ...serverHandoff,
    routeLoader: createRouteLoader(routeModules),
    serverHandoffString: createServerHandoffString(serverHandoff)
  };

  return serverEntryModule.default(req, statusCode, serverEntryContext);
}

function rewriteRoutes(config: RemixConfig, matches: ConfigRouteMatch[]) {
  config.routes = matches.reduceRight((children, match) => {
    let route = { ...match.route };
    if (children.length) route.children = children;
    return [route];
  }, [] as ConfigRouteObject[]);
}

function rewritePublicPath(config: RemixConfig) {
  config.publicPath =
    process.env.REMIX_RUN_ORIGIN || `http://localhost:${config.devServerPort}/`;
}

function getPartialManifest(
  assetManifest: AssetManifest,
  keys: string[]
): AssetManifest {
  return keys.reduce((memo, key) => {
    if (assetManifest[key]) memo[key] = assetManifest[key];
    return memo;
  }, {} as AssetManifest);
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
