import type { Location } from "history";
import { parsePath } from "history";
import jsesc from "jsesc";

import type { BuildManifest, ServerEntryModule, RouteModules } from "./build";
import {
  getBrowserBuildManifest,
  getServerBuildManifest,
  getServerEntryModule,
  getRouteModules,
  getDevBrowserBuildManifest,
  getDevServerEntryModule,
  getDevRouteModules
} from "./build";
import { generateDevServerBuild } from "./compiler";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import type { EntryContext } from "./entry";
import {
  createRouteData,
  createRouteDataResults,
  createRouteManifest,
  createRouteParams
} from "./entry";
import type { AppLoadContext } from "./loader";
import {
  LoaderResult,
  LoaderResultChangeStatusCode,
  LoaderResultRedirect,
  LoaderResultError,
  loadData,
  loadDataDiff
} from "./loader";
import type { RemixRouteMatch } from "./match";
import { matchRoutes } from "./match";
import type { Request } from "./platform";
import { Response } from "./platform";
import type { RemixRouteObject } from "./routes";
import { purgeRequireCache } from "./requireCache";

export interface RequestHandler {
  (request: Request, loadContext: AppLoadContext): Promise<Response>;
}

function createLocation(
  url: string,
  state: Location["state"] = null,
  key: Location["key"] = "default"
): Location {
  let { pathname = "/", search = "", hash = "" } = parsePath(url);
  return { pathname, search, hash, state, key };
}

/**
 * Creates a HTTP request handler.
 */
export function createRequestHandler(remixRoot?: string): RequestHandler {
  let configPromise = readConfig(remixRoot);

  return async (req, loadContext) => {
    if (process.env.NODE_ENV === "development") {
      let config = await configPromise;
      purgeRequireCache(config.rootDirectory);
      configPromise = readConfig(remixRoot);
    }

    let config = await configPromise;

    // GET /__remix_data?path=/gists
    // GET /__remix_data?from=/gists&path=/gists/123
    if (req.url.startsWith("/__remix_data")) {
      return handleDataRequest(config, req, loadContext);
    }

    // GET /__remix_manifest?path=/gists
    if (req.url.startsWith("/__remix_manifest")) {
      return handleManifestRequest(config, req);
    }

    // GET /gists
    return handleHtmlRequest(config, req, loadContext);
  };
}

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

async function handleDataRequest(
  config: RemixConfig,
  req: Request,
  context: AppLoadContext
): Promise<Response> {
  let location = createLocation(req.url);
  let params = new URLSearchParams(location.search);
  let path = params.get("path");
  let from = params.get("from");

  if (!path) {
    return jsonError(`Missing ?path`, 403);
  }

  let matches = matchRoutes(config.routes, path);

  if (!matches) {
    return jsonError(`No routes matched path "${path}"`, 404);
  }

  let loaderResults;
  if (from) {
    let fromMatches = matchRoutes(config.routes, from) || [];

    loaderResults = await loadDataDiff(
      config,
      matches,
      fromMatches,
      location,
      context
    );
  } else {
    loaderResults = await loadData(config, matches, location, context);
  }

  // TODO: How to handle redirects/status code changes?

  let dataResults = createRouteDataResults(loaderResults);

  return json(dataResults);
}

async function handleManifestRequest(config: RemixConfig, req: Request) {
  let location = createLocation(req.url);
  let params = new URLSearchParams(location.search);
  let path = params.get("path");

  if (!path) {
    return jsonError(`Missing ?path`, 403);
  }

  let matches = matchRoutes(config.routes, path);

  if (!matches) {
    return jsonError(`No routes matched path "${path}"`, 404);
  }

  let browserManifest: BuildManifest;
  if (process.env.NODE_ENV === "development") {
    rewriteConfigPublicPath(config);

    try {
      browserManifest = await getDevBrowserBuildManifest(config.publicPath);
    } catch (error) {
      // The dev server is not running. This is just a manifest patch request, so
      // return an empty patch. We will serve an error page on the HTML request.
      browserManifest = {};
    }
  } else {
    browserManifest = getBrowserBuildManifest(config.serverBuildDirectory);
  }

  // Get the browser manifest for only the matched routes.
  let manifestKeys = [
    ...matches.map(match => match.route.id),
    ...matches.map(match => `style/${match.route.id}.css`)
  ];
  let partialBrowserManifest = getPartialManifest(
    browserManifest,
    manifestKeys
  );
  let routeManifest = createRouteManifest(matches);

  return json({ buildManifest: partialBrowserManifest, routeManifest });
}

async function handleHtmlRequest(
  config: RemixConfig,
  req: Request,
  context: AppLoadContext
): Promise<Response> {
  let matches = matchRoutes(config.routes, req.url);

  let location = createLocation(req.url);
  let statusCode = 200;
  let loaderResults: LoaderResult[] = [];

  if (!matches) {
    statusCode = 404;
    matches = [
      {
        pathname: location.pathname,
        params: {},
        route: {
          path: location.pathname,
          id: "routes/404",
          componentFile: "routes/404.js"
        }
      }
    ];
  } else {
    loaderResults = await loadData(config, matches, location, context);

    let redirectResult = loaderResults.find(
      (result): result is LoaderResultRedirect =>
        result instanceof LoaderResultRedirect
    );

    if (redirectResult) {
      return new Response(`Redirecting to ${redirectResult.location}`, {
        status: redirectResult.httpStatus,
        headers: {
          Location: redirectResult.location
        }
      });
    }

    let errorResult = loaderResults.find(
      (result: LoaderResult): result is LoaderResultError =>
        result instanceof LoaderResultError
    );

    if (errorResult) {
      statusCode = errorResult.httpStatus;
      matches = [
        {
          pathname: location.pathname,
          params: {},
          route: {
            path: "*",
            id: "routes/500",
            componentFile: "routes/500.js"
          }
        }
      ];
    } else {
      let changeStatusCodeResult = loaderResults.find(
        (result): result is LoaderResultChangeStatusCode =>
          result instanceof LoaderResultChangeStatusCode
      );

      if (changeStatusCodeResult) {
        statusCode = changeStatusCodeResult.httpStatus;
        matches = [
          {
            pathname: location.pathname,
            params: {},
            route: {
              path: "*",
              id: `routes/${changeStatusCodeResult.httpStatus}`,
              componentFile: `routes/${changeStatusCodeResult.httpStatus}.js`
            }
          }
        ];
      }
    }
  }

  let browserManifest: BuildManifest;
  let serverEntryModule: ServerEntryModule;
  let routeModules: RouteModules;
  if (process.env.NODE_ENV === "development") {
    // Adjust `config.routes` so that only the routes that are matched in the
    // current request are available. This should speed up the build since we
    // only build the matched routes.
    rewriteConfigRoutes(config, matches);
    rewriteConfigPublicPath(config);

    try {
      browserManifest = await getDevBrowserBuildManifest(config.publicPath);
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
    browserManifest = getBrowserBuildManifest(config.serverBuildDirectory);

    let serverManifest = getServerBuildManifest(config.serverBuildDirectory);

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

  let routeData = createRouteData(loaderResults);
  let routeManifest = createRouteManifest(matches);
  let routeParams = createRouteParams(matches);

  // Get the browser manifest for only the browser entry point + the matched
  // routes. The client will fill in the rest by making requests to the manifest
  // endpoint as needed.
  let manifestKeys = [
    "entry-browser",
    "global.css",
    ...matches.map(match => match.route.id),
    ...matches.map(match => `style/${match.route.id}.css`)
  ];
  let partialBrowserManifest = getPartialManifest(
    browserManifest,
    manifestKeys
  );

  let partialEntryContext = {
    browserManifest: partialBrowserManifest,
    publicPath: config.publicPath,
    routeManifest,
    routeData,
    routeParams
  };

  let entryContext: EntryContext = Object.assign({}, partialEntryContext, {
    browserEntryContextString: jsesc(partialEntryContext, {
      isScriptContext: true
    }),
    routeLoader: {
      preload() {
        throw new Error(
          `Cannot preload routes on the server because we can't suspend`
        );
      },
      read(_assets: any, routeId: string) {
        return routeModules[routeId];
      },
      readSafely(_assets: any, routeId: string) {
        return routeModules[routeId];
      }
    }
  });

  return serverEntryModule.default(req, statusCode, entryContext);
}

function getPartialManifest(
  browserManifest: BuildManifest,
  keys: string[]
): BuildManifest {
  return keys.reduce((memo, key) => {
    if (browserManifest[key]) {
      memo[key] = browserManifest[key];
    }

    return memo;
  }, {} as BuildManifest);
}

function rewriteConfigRoutes(config: RemixConfig, matches: RemixRouteMatch[]) {
  let route = matches.reduceRight<RemixRouteObject | null>(
    (childRoute, match) => {
      let route = match.route;
      if (childRoute) route.children = [childRoute];
      return route;
    },
    null
  );

  config.routes = [route!];
}

function rewriteConfigPublicPath(config: RemixConfig) {
  config.publicPath =
    process.env.REMIX_RUN_ORIGIN || `http://localhost:${config.devServerPort}/`;
}
