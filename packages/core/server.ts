import path from "path";
import type { Component } from "react";
import type { Params } from "react-router";

import type { Manifest } from "./rollup/manifest";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import type { LoadContext, MatchAndLoadResult, RemixRouteMatch } from "./match";
import { matchAndLoadData, matchRoutes } from "./match";
import type { Request } from "./platform";
import { Response } from "./platform";

export interface RemixContext {
  data: MatchAndLoadResult;
  matches: RemixRouteMatch[];
  partialManifest: Manifest;
  requireRoute: (id: string) => RouteEntry;
}

// x Pass remixContext to the server entry
// x Server entry requires remix-run/react/server and passes args
// x remix-run/react/server renders <EntryProvider> w/ <StaticRouter>
// - remix-run/react/index has <EntryProvider>
//   - creates routes from manifest
//   - renders
// - <RemixRoute preload> is going to dynamically load
//   - on the server it just gets it from the lookup table
//   - on the client it gets it from cache or network (throws a promise)

export interface RequestHandler {
  (request: Request, loadContext: LoadContext): Promise<Response>;
}

/**
 * Creates a HTTP request handler.
 */
export function createRequestHandler(remixRoot?: string): RequestHandler {
  let init = initializeServer(remixRoot);

  return async (req, loadContext) => {
    // if (process.env.NODE_ENV === 'development') {
    //   purgeRequireCache(remixRoot);
    //   init = initializeServer(remixRoot);
    // }

    let { config, manifest, routeEntries, serverEntry } = await init;

    // /__remix_data?path=/gists
    // /__remix_data?from=/gists&path=/gists/123
    if (req.url.startsWith("/__remix_data")) {
      let split = req.url.split("?");
      let params = new URLSearchParams(split[1]);
      let path = params.get("path");
      let from = params.get("from");

      if (!path) {
        return new Response("Missing ?path", {
          status: 403,
          headers: {
            "Content-Type": "text/html"
          }
        });
      }

      let data = await matchAndLoadData(config, path, loadContext, from);

      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

    let matches = matchRoutes(config.routes, req.url);

    if (!matches) {
      return new Response("Missing routes/404.js", {
        status: 500,
        headers: {
          "Content-Type": "text/html"
        }
      });
    }

    // TODO: Refactor later...
    let data = await matchAndLoadData(config, req.url, loadContext);

    let partialManifest = matches.reduce((memo, match) => {
      let routeId = match.route.id;
      memo[routeId] = manifest[routeId];
      return memo;
    }, {} as Manifest);

    let requireRoute = (id: string) => routeEntries[id];

    let remixContext: RemixContext = {
      data,
      matches,
      partialManifest,
      requireRoute
    };

    return serverEntry.default(req, remixContext);
  };
}

async function initializeServer(remixRoot?: string) {
  let config = await readConfig(remixRoot);
  let manifest = readManifest(config.serverBuildDirectory);
  let routeEntries = createRouteEntries(
    config.serverBuildDirectory,
    config.routes,
    manifest
  );
  let serverEntry = createServerEntry(config.serverBuildDirectory, manifest);

  return { config, manifest, routeEntries, serverEntry };
}

function readManifest(serverBuildDirectory: string): Manifest {
  let manifestFile = path.join(serverBuildDirectory, "manifest.json");
  return require(manifestFile);
}

interface MetaArgs {
  data: any;
  params: Params;
  location: Location;
}

type MetaTagName = string;
type MetaTagContent = string;
type MetaContents = Record<MetaTagName, MetaTagContent>;

interface RouteEntry {
  meta?: (metaArgs: MetaArgs) => MetaContents;
  default: Component;
}

type RouteEntries = Record<string, RouteEntry>;

function createRouteEntries(
  serverBuildDirectory: string,
  routes: RemixConfig["routes"],
  manifest: Manifest,
  table: RouteEntries = {}
): RouteEntries {
  for (let route of routes) {
    let requirePath = path.join(
      serverBuildDirectory,
      manifest[route.id].fileName
    );

    table[route.id] = require(requirePath);

    if (route.children) {
      createRouteEntries(serverBuildDirectory, route.children, manifest, table);
    }
  }

  return table;
}

interface ServerEntry {
  default: (req: Request, remixContext: RemixContext) => Promise<Response>;
}

function createServerEntry(
  serverBuildDirectory: string,
  manifest: Manifest
): ServerEntry {
  let requirePath = path.join(
    serverBuildDirectory,
    manifest["__entry_server__"].fileName
  );

  return require(requirePath);
}
