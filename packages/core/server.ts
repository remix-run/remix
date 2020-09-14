import type { Location } from "history";
import { parsePath } from "history";

import type {
  BuildManifest,
  RemixServerContext,
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
import type { AppLoadContext } from "./load";
import { loadData } from "./load";
import { matchRoutes } from "./match";
import type { Request } from "./platform";
import { Response } from "./platform";
import { purgeRequireCache } from "./require";

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
  let init = initializeServer(remixRoot);

  return async (req, loadContext) => {
    if (process.env.NODE_ENV === "development") {
      let { config } = await init;
      purgeRequireCache(config.rootDirectory);
      init = initializeServer(remixRoot);
    }

    let serverInit = await init;

    // /__remix_data?path=/gists
    // /__remix_data?from=/gists&path=/gists/123
    if (req.url.startsWith("/__remix_data")) {
      return handleDataRequest(serverInit, req, loadContext);
    }

    // /gists
    // /gists/123
    return handleHtmlRequest(serverInit, req, loadContext);
  };
}

interface ServerInit {
  config: RemixConfig;
  manifest: BuildManifest;
  serverEntryModule: ServerEntryModule;
  routeModules: RouteModules;
}

async function initializeServer(remixRoot?: string): Promise<ServerInit> {
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
  serverInit: ServerInit,
  req: Request,
  loadContext: AppLoadContext
): Promise<Response> {
  let { config } = serverInit;
  let location = createLocation(req.url);
  let split = req.url.split("?");
  let params = new URLSearchParams(split[1]);
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

  let fromMatches = from ? matchRoutes(config.routes, from) : null;
  let data = await loadData(
    config,
    matches,
    fromMatches,
    loadContext,
    location
  );

  // TODO: How do we cache this?
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json"
    }
  });
}

async function handleHtmlRequest(
  serverInit: ServerInit,
  req: Request,
  loadContext: AppLoadContext
): Promise<Response> {
  let { config, manifest, routeModules, serverEntryModule } = serverInit;
  let location = createLocation(req.url);
  let matches = matchRoutes(config.routes, req.url);

  if (!matches) {
    // TODO: Maybe warn the user about missing routes/404.js before now
    return new Response("Missing routes/404.js", {
      status: 500,
      headers: {
        "Content-Type": "text/html"
      }
    });
  }

  let notFound = matches.length === 1 && matches[0].route.path === "*";
  let statusCode = notFound ? 404 : 200;

  let data = await loadData(config, matches, null, loadContext, location);

  let partialManifest = matches.reduce((memo, match) => {
    let routeId = match.route.id;
    memo[routeId] = manifest[routeId];
    return memo;
  }, {} as BuildManifest);

  let remixContext: RemixServerContext = {
    matches,
    data,
    partialManifest,
    requireRoute(id: string) {
      return routeModules[id];
    }
  };

  return serverEntryModule.default(req, statusCode, remixContext);
}
