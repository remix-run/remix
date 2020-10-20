import path from "path";
import type { Params } from "react-router";

import type { RemixConfig } from "./config";
import { Response, isResponseLike } from "./fetch";

/**
 * Some data that was returned from a data loader.
 */
export type AppData = any;

/**
 * An object of data returned from the server's `getLoadContext` function. This
 * will be passed to the data loaders.
 */
export type AppLoadContext = any;

/**
 * The result from executing a data loader.
 */
export type AppLoadResult = Response | null;

/**
 * A function that loads data for a route or the global data loader.
 */
export interface DataLoader {
  (args: { context: AppLoadContext; params: Params; url: URL }): AppData;
}

function requireLoader(config: RemixConfig, loaderFile: string): DataLoader {
  let requirePath = path.resolve(config.loadersDirectory, loaderFile);
  return require(requirePath);
}

async function executeLoader(
  loader: DataLoader,
  loadContext: AppLoadContext,
  url: URL,
  routeParams: Params = {}
): Promise<Response> {
  let value = await loader({
    context: loadContext,
    params: routeParams,
    url
  });

  if (isResponseLike(value)) {
    return value;
  }

  return new Response(JSON.stringify(value), {
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

/**
 * Loads data using the global data loader at `data/global.js`.
 */
export function loadGlobalData(
  config: RemixConfig,
  loadContext: AppLoadContext,
  url: URL
): Promise<AppLoadResult> {
  let loader;
  try {
    loader = requireLoader(config, "global");
  } catch (error) {
    // No problem if the global loader is missing. It just
    // means there isn't any global data.
    return Promise.resolve(null);
  }

  return executeLoader(loader, loadContext, url);
}

/**
 * Loads data for a given route id.
 */
export function loadRouteData(
  config: RemixConfig,
  routeId: string,
  routeParams: Params,
  loadContext: AppLoadContext,
  url: URL
): Promise<AppLoadResult> {
  let route = config.routeManifest[routeId];

  if (!route.loaderFile) {
    return Promise.resolve(null);
  }

  let loader = requireLoader(config, route.loaderFile);
  return executeLoader(loader, loadContext, url, routeParams);
}

/**
 * Extracts the actual data from a data loader result.
 */
export function extractData(loadResult: AppLoadResult): Promise<AppData> {
  if (!loadResult) {
    return Promise.resolve(null);
  }

  let contentType = loadResult.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return loadResult.json();
  }

  // TODO: Should we handle binary data types here? People gonna be returning
  // video/images from their data loaders someday?

  return loadResult.text();
}
