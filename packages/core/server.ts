import type { Location } from "history";
import { parsePath } from "history";
import jsesc from "jsesc";

import type { BuildManifest, ServerEntryModule, RouteModules } from "./build";
import {
  getBrowserManifest,
  getRouteModules,
  getDevRouteModules,
  getServerEntryModule,
  getDevServerEntryModule,
  getServerManifest
} from "./build";
import { BuildMode, BuildTarget, build } from "./compiler";
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

    // GET /__remix_patch?path=/gists
    if (req.url.startsWith("/__remix_patch")) {
      return handlePatchRequest(config, req);
    }

    // GET /gists
    return handleHtmlRequest(config, req, loadContext);
  };
}

interface RemixServerInit {
  config: RemixConfig;
  browserManifest: BuildManifest;
  routeModules: RouteModules;
  serverEntryModule: ServerEntryModule;
}

async function initializeServer(remixRoot?: string): Promise<RemixServerInit> {
  let config = await readConfig(remixRoot);

  // TODO: Get this from the asset server (`remix run`) in dev
  let browserManifest = getBrowserManifest(config.serverBuildDirectory);

  // Production only
  let serverManifest = getServerManifest(config.serverBuildDirectory);
  let serverEntryModule = getServerEntryModule(
    config.serverBuildDirectory,
    serverManifest
  );
  let routeModules = getRouteModules(
    config.serverBuildDirectory,
    config.routes,
    serverManifest
  );

  // In development
  // only build and load the routes we need for this request

  return { config, browserManifest, serverEntryModule, routeModules };
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
    return new Response(JSON.stringify({ error: "Missing ?path" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  let matches = matchRoutes(config.routes, path);

  if (!matches) {
    return new Response(JSON.stringify({ error: "No routes matched" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json"
      }
    });
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

  // TODO: How do we cache this?
  return new Response(JSON.stringify(dataResults), {
    headers: {
      "Content-Type": "application/json"
    }
  });
}

async function handlePatchRequest(config: RemixConfig, req: Request) {
  let browserManifest = getBrowserManifest(config.serverBuildDirectory);

  let location = createLocation(req.url);
  let params = new URLSearchParams(location.search);
  let path = params.get("path");

  if (!path) {
    return new Response(JSON.stringify({ error: "Missing ?path" }), {
      status: 403,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  let matches = matchRoutes(config.routes, path);

  if (!matches) {
    return new Response(`No matches found for ${path}`, {
      status: 404
    });
  }

  let matchedRouteIds = matches.map(match => match.route.id);
  let routeManifest = createRouteManifest(matches);

  // Get the browser manifest for only the matched routes.
  let partialBrowserManifest = getPartialManifest(
    browserManifest,
    matchedRouteIds
  );

  let payload = {
    build: partialBrowserManifest,
    routes: routeManifest
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json"
    }
  });
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
          path: "*",
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

  // TODO: Get this from the dev server...
  let browserManifest = getBrowserManifest(config.serverBuildDirectory);

  let serverEntryModule: ServerEntryModule;
  let routeModules: RouteModules;
  if (process.env.NODE_ENV === "development") {
    // Adjust `config.routes` so that only the routes that are matched in the
    // current request are available.
    rewriteConfigRoutes(config, matches);

    config.publicPath = "http://localhost:8002/";

    let serverBuild = await build(config, {
      mode: BuildMode.Development,
      target: BuildTarget.Server
    });
    let { output } = await serverBuild.generate({
      format: "cjs",
      exports: "named"
    });

    serverEntryModule = getDevServerEntryModule(
      config.serverBuildDirectory,
      output
    );
    routeModules = getDevRouteModules(
      config.serverBuildDirectory,
      config.routes,
      output
    );
  } else {
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

  let routeData = createRouteData(loaderResults);
  let routeManifest = createRouteManifest(matches);
  let routeParams = createRouteParams(matches);

  // Get the browser manifest for only the browser entry point + the matched routes.
  let matchedRouteIds = matches.map(match => match.route.id);
  let partialBrowserManifest = getPartialManifest(
    browserManifest,
    ["__entry_browser__", "__entry_styles__.css"].concat(matchedRouteIds)
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
      read(routeId: string) {
        return routeModules[routeId];
      },
      load() {
        throw new Error(
          `Cannot load routes on the server because we can't suspend`
        );
      }
    }
  });

  return serverEntryModule.default(req, statusCode, entryContext);
}

function getPartialManifest(
  manifest: BuildManifest,
  entryNames: string[]
): BuildManifest {
  return entryNames.reduce((memo, entryName) => {
    memo[entryName] = manifest[entryName];

    if (manifest[`${entryName}.css`]) {
      memo[`${entryName}.css`] = manifest[`${entryName}.css`];
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
