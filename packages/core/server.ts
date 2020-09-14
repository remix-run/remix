import type { BuildManifest, RemixServerContext } from "./build";
import {
  getBuildManifest,
  getRouteModules,
  getServerEntryModule
} from "./build";
import { readConfig } from "./config";
import type { LoadContext } from "./match";
import { matchAndLoadData, matchRoutes } from "./match";
import type { Request } from "./platform";
import { Response } from "./platform";
// import { purgeRequireCache } from './require'

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

    let { config, manifest, serverEntryModule, routeModules } = await init;

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

      // TODO: How do we cache this?
      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }

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

    // let notFound = matches.length === 1 && matches[0].route.path === "*";
    // if (notFound) {
    //   return serverNotFoundModule.default(req, remixContext);
    // }

    // TODO: Refactor later...
    let data = await matchAndLoadData(config, req.url, loadContext);

    let partialManifest = matches.reduce((memo, match) => {
      let routeId = match.route.id;
      memo[routeId] = manifest[routeId];
      return memo;
    }, {} as BuildManifest);

    let remixContext: RemixServerContext = {
      matches,
      data, // LoadResult[] | null
      partialManifest,
      requireRoute(id: string) {
        return routeModules[id];
      }
    };

    return serverEntryModule.default(req, /*resStatusCode,*/ remixContext);
  };
}

async function initializeServer(remixRoot?: string) {
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
