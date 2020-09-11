import path from "path";
import type { Component } from "react";
import type { Params } from "react-router";

import type { Manifest } from "./rollup/manifest";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import type { LoadContext } from "./match";
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
    let { config, lookupTable, serverEntry } = await init;

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

    return serverEntry.default(data);
  };
}

async function initializeServer(remixRoot?: string) {
  let config = await readConfig(remixRoot);
  let manifest = readManifest(config);

  let lookupTable = createRoutesLookupTable(
    config.routes,
    config.serverBuildDirectory,
    manifest
  );

  let serverEntry = require(path.join(
    config.serverBuildDirectory,
    manifest["__entry_server__"].fileName
  ));

  return { config, lookupTable, serverEntry };
}

function readManifest(config: RemixConfig): Manifest {
  return require(path.join(config.serverBuildDirectory, "manifest.json"));
}

interface MetaArgs {
  data: any;
  params: Params;
  location: Location;
}

type MetaTagName = string;
type MetaTagContent = string;
type MetaContents = Record<MetaTagName, MetaTagContent>;

interface RouteModule {
  meta?: (metaArgs: MetaArgs) => MetaContents;
  default: Component;
}

type RoutesLookupTable = Record<string, RouteModule>;

function createRoutesLookupTable(
  routes: RemixConfig["routes"],
  serverBuildDirectory: string,
  manifest: Manifest,
  table: RoutesLookupTable = {}
): RoutesLookupTable {
  for (let route of routes) {
    let requirePath = path.join(
      serverBuildDirectory,
      manifest[route.id].fileName
    );

    table[route.id] = require(requirePath);

    if (route.children) {
      createRoutesLookupTable(
        route.children,
        serverBuildDirectory,
        manifest,
        table
      );
    }
  }

  return table;
}
