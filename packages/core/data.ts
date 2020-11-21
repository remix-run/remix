import path from "path";
import type { Params } from "react-router";

import type { ConfigRouteObject } from "./routes";
import { Request, Response, isResponseLike } from "./fetch";
import { json, redirect } from "./responseHelpers";
import invariant from "./invariant";

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
 * A function that handles data mutations for a route.
 */
export interface DataAction {
  (arg: { context: AppLoadContext; request: Request; params: Params }):
    | Promise<Response>
    | Response;
}

/**
 * A function that loads data for a route or the global data loader.
 */
export interface DataLoader {
  (arg: { context: AppLoadContext; request: Request; params: Params }):
    | Promise<AppData>
    | AppData;
}

/**
 * A module that defines a loader and/or action for a route.
 */
export interface DataModule {
  action?: DataAction;
  loader?: DataLoader;
}

function loadDataModule(dataDirectory: string, filename: string): DataModule {
  return require(path.resolve(dataDirectory, filename));
}

async function executeLoader(
  loader: DataLoader,
  context: AppLoadContext,
  request: Request,
  params: Params = {}
): Promise<Response> {
  let result = await loader({ context, request, params });
  return isResponseLike(result) ? result : json(result);
}

/**
 * Loads data using the global data loader at `data/global.js`.
 */
export function loadGlobalData(
  dataDirectory: string,
  context: AppLoadContext,
  request: Request
): Promise<AppLoadResult> {
  let dataModule;
  try {
    dataModule = loadDataModule(dataDirectory, "global");
  } catch (error) {
    // No problem if the global loader is missing. It just
    // means there isn't any global data.
    return Promise.resolve(null);
  }

  if (!dataModule.loader) {
    return Promise.resolve(null);
  }

  return executeLoader(dataModule.loader, context, request);
}

/**
 * Loads the data for a given route.
 */
export function loadRouteData(
  dataDirectory: string,
  route: ConfigRouteObject,
  context: AppLoadContext,
  request: Request,
  routeParams: Params
): Promise<AppLoadResult> {
  if (!route.loaderFile) {
    return Promise.resolve(null);
  }

  let dataModule = loadDataModule(dataDirectory, route.loaderFile);

  if (!dataModule.loader) {
    return Promise.resolve(null);
  }

  return executeLoader(dataModule.loader, context, request, routeParams);
}

async function executeAction(
  action: DataAction,
  context: AppLoadContext,
  request: Request,
  params: Params = {}
): Promise<Response> {
  let result = await action({ context, request, params });
  let location = isResponseLike(result) && result.headers.get("Location");

  invariant(
    location,
    `You made a ${request.method} request to ${request.url} but did not return ` +
      `a redirect. Please \`return redirect(newUrl)\` from your \`action\` ` +
      `to avoid reposts when users click the back button.`
  );

  return redirect(location as string, 303);
}

/**
 * Calls the action for a given route.
 */
export function callRouteAction(
  dataDirectory: string,
  route: ConfigRouteObject,
  context: AppLoadContext,
  request: Request,
  params: Params
): Promise<Response> {
  invariant(
    route.loaderFile,
    `You made a ${request.method} request to ${request.url} but did not provide ` +
      `a data module for route "${route.id}", so there is no way to handle the ` +
      `request.`
  );

  let dataModule = loadDataModule(dataDirectory, route.loaderFile);

  invariant(
    dataModule.action,
    `You made a ${request.method} request to ${request.url} but did not provide ` +
      `an \`action\` function in the data module for route "${route.id}".`
  );

  return executeAction(dataModule.action, context, request, params);
}

/**
 * Extracts the actual data from a data loader result.
 */
export function extractData(result: AppLoadResult): Promise<AppData> {
  if (!result) {
    return Promise.resolve(null);
  }

  let contentType = result.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return result.json();
  }

  // Should we handle binary data types here? People gonna be returning
  // video/images from their data loaders someday?

  return result.text();
}
