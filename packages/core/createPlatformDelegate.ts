import path from "path";
import { parsePath } from "history";

import readRemixConfig, { RemixConfig } from "./readRemixConfig";

interface PlatformDelegate {
  getUrl(...platformArgs: any[]): string;
  sendJson(json: object, ...platformArgs: any[]): void;
}

interface AppRequestDelegate {
  getLoadContext(...platformArgs: any[]): any;
}

interface Platform {
  (appRequestDelegate: AppRequestDelegate): RequestHandler;
}

interface RequestHandler {
  (...platformArgs: any[]): void;
}

export default function createPlatform(
  platformDelegate: PlatformDelegate,
  root: string
): Platform {
  return (appRequestDelegate: AppRequestDelegate): RequestHandler => {
    // TODO: Maybe initialize some stuff here in production

    return async (...platformArgs: any[]) => {
      // TODO: Do this once when the server first boots in prod
      let remixConfig = await readRemixConfig(root);

      let url = platformDelegate.getUrl(...platformArgs);

      // Send data.
      if (url.startsWith("/_remix-data")) {
        let appLoadContext;
        if (appRequestDelegate.getLoadContext) {
          appLoadContext = appRequestDelegate.getLoadContext(...platformArgs);
        }

        let [, search] = url.split("?");
        let params = new URLSearchParams(search);
        let to = params.get("to");
        // FUTURE: probably don't need all of what match does inside, can make a
        // trimmed down version of it for data loading (and we'll want to stream
        // it for render-as-you-fetch, but this is easy as a first step)
        let result = await matchAndLoadData(remixConfig, url, appLoadContext);
        platformDelegate.sendJson(result, ...platformArgs);
        return;
      }
    };
  };
}

interface LoadDataResult {
  error: string;
  data: any[];
}

async function matchAndLoadData(
  remixConfig: RemixConfig,
  url: string,
  appLoadContext: any
): Promise<LoadDataResult> {
  let matches = matchRoutes(routesConfig, url);

  let is404 = matches.length === 1 && matches[0].route.path === "*";

  return [];
}

async function loadLoader(loader, appRoot, loadersDirectory) {
  let modulePath = path.resolve(appRoot, loadersDirectory, loader);
  let requirePath = path.relative(__dirname, modulePath);
  return await import(requirePath);
}

async function loadData({ paths, matches, loadContext, location }) {
  let loaders = matches.map((match, index) => {
    if (match.route.loader === null) {
      return null;
    }

    // TODO: maybe resolve this stuff at initialization instead
    let modulePath = path.resolve(
      paths.appRoot,
      paths.loadersDirectory,
      match.route.loader
    );
    let requirePath = path.relative(__dirname, modulePath);
    return require(requirePath);
  });

  let promises = loaders.map((loader, index) => {
    if (loader === null) {
      return null;
    } else {
      let params = matches[index].params;
      return loader({ params, context: loadContext, location });
    }
  });

  let results = await Promise.all(promises);
  return results.map((data, index) => {
    return { id: matches[index].route.id, data };
  });
}
