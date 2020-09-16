import type { Location } from "history";
import { parsePath } from "history";

import type {
  BuildManifest,
  RemixEntryContext,
  ServerEntryModule,
  RouteModules
} from "./build";
import {
  getBuildManifest,
  getRouteModules,
  getServerEntryModule
} from "./build";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import type { AppLoadContext } from "./loader";
import { loadData, loadDataDiff } from "./loader";
import {
  LoaderResult,
  LoaderResultChangeStatusCode,
  LoaderResultRedirect,
  LoaderResultError,
  stringifyLoaderResults
} from "./loaderResults";
import { matchRoutes } from "./match";
import type { Request } from "./platform";
import { Response } from "./platform";
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
  let initPromise = initializeServer(remixRoot);

  return async (req, loadContext) => {
    if (process.env.NODE_ENV === "development") {
      let { config } = await initPromise;
      purgeRequireCache(config.rootDirectory);
      initPromise = initializeServer(remixRoot);
    }

    let init = await initPromise;

    // /__remix_data?path=/gists
    // /__remix_data?from=/gists&path=/gists/123
    if (req.url.startsWith("/__remix_data")) {
      return handleDataRequest(init, req, loadContext);
    }

    // /gists
    // /gists/123
    return handleHtmlRequest(init, req, loadContext);
  };
}

interface RemixServerInit {
  config: RemixConfig;
  manifest: BuildManifest;
  serverEntryModule: ServerEntryModule;
  routeModules: RouteModules;
}

async function initializeServer(remixRoot?: string): Promise<RemixServerInit> {
  let config = await readConfig(remixRoot);

  let manifest = getBuildManifest(config.serverBuildDirectory);
  let serverEntryModule = getServerEntryModule(
    config.serverBuildDirectory,
    manifest
  );
  let routeModules = getRouteModules(
    config.serverBuildDirectory,
    config.routes,
    manifest
  );

  return { config, manifest, serverEntryModule, routeModules };
}

async function handleDataRequest(
  init: RemixServerInit,
  req: Request,
  context: AppLoadContext
): Promise<Response> {
  let { config } = init;

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

  let data;
  if (from) {
    let fromMatches = matchRoutes(config.routes, from) || [];
    data = await loadDataDiff(config, matches, fromMatches, location, context);
  } else {
    data = await loadData(config, matches, location, context);
  }

  // TODO: How do we cache this?
  return new Response(stringifyLoaderResults(data), {
    headers: {
      "Content-Type": "application/json"
    }
  });
}

async function handleHtmlRequest(
  init: RemixServerInit,
  req: Request,
  context: AppLoadContext
): Promise<Response> {
  let { config, manifest, routeModules, serverEntryModule } = init;

  let location = createLocation(req.url);
  let statusCode = 200;
  let matches = matchRoutes(config.routes, req.url);
  let data: LoaderResult[] = [];

  if (!matches) {
    statusCode = 404;
    matches = [
      {
        pathname: location.pathname,
        params: {},
        route: {
          path: "*",
          id: "routes/404",
          component: "routes/404.js",
          loader: null
        }
      }
    ];
  } else {
    data = await loadData(config, matches, location, context);

    // meta = Object.assign({}, route1(data, params, location), route2)

    let redirectResult = data.find(
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

    let errorResult = data.find(
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
            component: "routes/500.js",
            loader: null
          }
        }
      ];
    } else {
      let changeStatusCodeResult = data.find(
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
              component: `routes/${changeStatusCodeResult.httpStatus}.js`,
              loader: null
            }
          }
        ];
      }
    }
  }

  let partialManifest = matches.reduce((memo, match) => {
    let routeId = match.route.id;
    memo[routeId] = manifest[routeId];
    return memo;
  }, {} as BuildManifest);

  let remixContext: RemixEntryContext = {
    matches,
    data,
    partialManifest,
    requireRoute(routeId: string) {
      return routeModules[routeId];
    }
  };

  return serverEntryModule.default(req, statusCode, remixContext);
}
