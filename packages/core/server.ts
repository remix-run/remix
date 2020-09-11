import path from "path";

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
    let { config, manifest } = await init;

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
    let entry = require(manifest.__entry_server__.requirePath);

    return entry.default(data);
  };
}

async function initializeServer(remixRoot?: string) {
  let config = await readConfig(remixRoot);
  let manifest = readManifest(config);
  return { config, manifest };
}

function readManifest(config: RemixConfig): Manifest {
  return require(path.join(config.serverBuildDirectory, "manifest.json"));
}
