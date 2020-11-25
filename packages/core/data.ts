import path from "path";
import type { Params } from "react-router";

import { Request, Response, isResponseLike } from "./fetch";
import type { ConfigRouteObject } from "./routes";
import { json, redirect } from "./responseHelpers";
import type { Session } from "./sessions";
import invariant from "./invariant";

/**
 * An object of data returned from the server's `getLoadContext` function. This
 * will be passed to the data loaders.
 */
export type AppLoadContext = any;

/**
 * Some data that was returned from a data loader.
 */
export type AppData = any;

/**
 * A function that handles data mutations for a route.
 */
export interface DataAction {
  (arg: {
    request: Request;
    session: Session;
    context: AppLoadContext;
    params: Params;
  }): Promise<Response> | Response;
}

/**
 * A function that loads data for a route or the global data loader.
 */
export interface DataLoader {
  (arg: {
    request: Request;
    session: Session;
    context: AppLoadContext;
    params: Params;
  }): Promise<AppData> | AppData;
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
  request: Request,
  session: Session,
  context: AppLoadContext,
  params: Params = {}
): Promise<Response> {
  let result = await loader({ request, session, context, params });
  return isResponseLike(result) ? result : json(result);
}

/**
 * Loads data using the global data loader at `data/global.js`.
 */
export function loadGlobalData(
  dataDirectory: string,
  request: Request,
  session: Session,
  context: AppLoadContext
): Promise<Response> {
  let dataModule;
  try {
    dataModule = loadDataModule(dataDirectory, "global");
  } catch (error) {
    // No problem if the global loader is missing. It just
    // means there isn't any global data.
    return Promise.resolve(json(null));
  }

  if (!dataModule.loader) {
    return Promise.resolve(json(null));
  }

  return executeLoader(dataModule.loader, request, session, context);
}

/**
 * Loads the data for a given route.
 */
export function loadRouteData(
  dataDirectory: string,
  route: ConfigRouteObject,
  request: Request,
  session: Session,
  context: AppLoadContext,
  params: Params
): Promise<Response> {
  if (!route.loaderFile) {
    return Promise.resolve(json(null));
  }

  let dataModule = loadDataModule(dataDirectory, route.loaderFile);

  if (!dataModule.loader) {
    return Promise.resolve(json(null));
  }

  return executeLoader(dataModule.loader, request, session, context, params);
}

async function executeAction(
  action: DataAction,
  request: Request,
  session: Session,
  context: AppLoadContext,
  params: Params = {}
): Promise<Response> {
  let result = await action({ request, session, context, params });
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
  request: Request,
  session: Session,
  context: AppLoadContext,
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

  return executeAction(dataModule.action, request, session, context, params);
}

/**
 * Extracts the actual data from a data loader result.
 */
export function extractData(response: Response): Promise<AppData> {
  let contentType = response.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return response.json();
  }

  // What other data types do we need to handle here? What other kinds of
  // responses are people going to be returning from their loaders?
  // - application/x-www-form-urlencoded ?
  // - multipart/form-data ?
  // - binary (audio/video) ?

  return response.text();
}
