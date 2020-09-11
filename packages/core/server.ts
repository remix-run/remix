import path from "path";

import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import type { LoadContext } from "./match";
import { matchAndLoadData } from "./match";
import type { Request } from "./platform";
import { Response } from "./platform";

export interface RequestHandler {
  (request: Request, loadContext: LoadContext): Promise<Response>;
}

/**
 * Creates a HTTP request handler.
 */
export function createRequestHandler(remixRoot?: string): RequestHandler {
  let configPromise = readConfig(remixRoot);
  let manifestPromise = configPromise.then(readManifest);

  return async (req, loadContext) => {
    let config = await configPromise;
    let manifest = await manifestPromise;

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

function readManifest(config: RemixConfig) {
  return require(path.join(config.serverBuildDirectory, "manifest.json"));
}
