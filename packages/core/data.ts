import path from "path";
import type { Params } from "react-router";

import type { ConfigRouteObject } from "./routes";
import { Request, Response, isResponseLike } from "./fetch";

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
export type Loader = (args: {
  context: AppLoadContext;
  params: Params;
  request: Request;
}) => Promise<AppData> | AppData;

export type Action = (args: {
  context: AppLoadContext;
  params: Params;
  request: Request;
}) => Promise<Response> | Response;

export interface DataLoader {
  loader?: Loader;
  action?: Action;
}

function requireLoader(
  loadersDirectory: string,
  loaderFile: string
): DataLoader {
  let requirePath = path.resolve(loadersDirectory, loaderFile);
  return require(requirePath);
}

async function executeLoader(
  loaderModule: DataLoader,
  loadContext: AppLoadContext,
  request: Request,
  routeParams: Params = {},
  isAction: boolean = false
): Promise<Response> {
  let method = isAction ? loaderModule.action : loaderModule.loader;

  if (!method) {
    let methodName = isAction ? "action" : "loader";
    throw new Error(
      `You made a ${request.method} request to ${request.url} but did not export an \`${methodName}\` function.`
    );
  }

  let value = await method({
    context: loadContext,
    params: routeParams,
    request: request
  });

  if (isAction) {
    let location = value?.headers?.get("location");

    if (!isResponseLike(value) || !location) {
      throw new Error(
        `You made a ${request.method} to ${request.url} but did not return a \`redirect\`. Please \`return redirect(newUrl)\` from your loader to avoid reposts when users click the back button.`
      );
    }

    if (value.status !== 302 && value.status !== 303) {
      console.warn(
        `Loader actions shouldn't return a ${value.status}. Remix changed it to 303.`
      );
    }

    return value.status === 303
      ? value
      : new Response("", {
          status: 303,
          headers: { location }
        });
  }

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
  loadersDirectory: string,
  loadContext: AppLoadContext,
  request: Request
): Promise<AppLoadResult> {
  let loader;
  try {
    loader = requireLoader(loadersDirectory, "global");
  } catch (error) {
    // No problem if the global loader is missing. It just
    // means there isn't any global data.
    return Promise.resolve(null);
  }

  return executeLoader(loader, loadContext, request);
}

/**
 * Loads data for a given route id.
 */
export function loadRouteData(
  loadersDirectory: string,
  route: ConfigRouteObject,
  routeParams: Params,
  loadContext: AppLoadContext,
  request: Request,
  isAction: boolean
): Promise<AppLoadResult> {
  if (!route.loaderFile) {
    return Promise.resolve(null);
  }

  let loader = requireLoader(loadersDirectory, route.loaderFile);
  return executeLoader(loader, loadContext, request, routeParams, isAction);
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

  // Should we handle binary data types here? People gonna be returning
  // video/images from their data loaders someday?

  return loadResult.text();
}
