import { promises as fsp } from "fs";
import path from "path";
import type { Component } from "react";
import type { Params } from "react-router";

import type { Manifest } from "./rollup/manifest";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import type { LoadContext, MatchAndLoadResult } from "./match";
import { matchAndLoadData } from "./match";
import type { Request } from "./platform";
import { Response } from "./platform";

// 1. Get a URL that matches multiple routes
// 2. Pass a partial manifest to the app request handler, it renders a remix
//    entry provider
// 3. Entry provider creates a route tree from the manifest of routes w/ preload
// 4. Remix route loads the entry dynamically

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

    let { config, routeEntries, serverEntry } = await init;

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

    let data = await matchAndLoadData(config, req.url, loadContext);
    let remixContext = { data };

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

  return { config, routeEntries, serverEntry };
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

interface RemixContext {
  data: MatchAndLoadResult;
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
