import path from "path";
import type { Location } from "history";
import type { Params } from "react-router";

import type { RemixConfig } from "./config";
import type { ConfigRouteMatch } from "./match";
import { StatusCode, Redirect } from "./platform";

/**
 * An object of data returned from the server's `getLoadContext` function. This
 * will be passed to the loaders.
 */
export type AppLoadContext = any;

/**
 * A function that loads data for a route or the global data loader.
 */
export interface DataLoader {
  (args: {
    context: AppLoadContext;
    pathname: string;
    search: string;
    params: Params;
  }): any;
}

export class LoaderResult {
  readonly routeId: string;
  readonly httpStatus: number;
  constructor(routeId: string, httpStatus = 200) {
    this.routeId = routeId;
    this.httpStatus = httpStatus;
  }
}

export class LoaderResultChangeStatusCode extends LoaderResult {}

export class LoaderResultCopy extends LoaderResult {}

export class LoaderResultError extends LoaderResult {
  readonly message: string;
  readonly stack?: string;
  constructor(routeId: string, message: string, stack?: string) {
    super(routeId, 500);
    this.message = message;
    this.stack = stack;
  }
}

export class LoaderResultRedirect extends LoaderResult {
  readonly location: string;
  readonly permanent: boolean;
  constructor(routeId: string, location: string, permanent = false) {
    super(routeId, permanent ? 301 : 302);
    this.location = location;
    this.permanent = permanent;
  }
}

export class LoaderResultSuccess extends LoaderResult {
  readonly data: any;
  constructor(routeId: string, data: any) {
    super(routeId);
    this.data = data;
  }
}

function requireLoader(config: RemixConfig, loaderFile: string): DataLoader {
  let requirePath = path.resolve(config.dataDirectory, loaderFile);
  return require(requirePath);
}

async function executeLoader(
  loader: DataLoader | null,
  routeId: string,
  context: AppLoadContext,
  pathname: string,
  search: string,
  params: Params = {}
): Promise<LoaderResult> {
  if (loader == null) {
    return new LoaderResultSuccess(routeId, null);
  } else {
    try {
      let result = await loader({ context, pathname, search, params });

      if (result instanceof StatusCode) {
        return new LoaderResultChangeStatusCode(routeId, result.status);
      } else if (result instanceof Redirect) {
        return new LoaderResultRedirect(
          routeId,
          result.location,
          result.permanent
        );
      }

      return new LoaderResultSuccess(routeId, result);
    } catch (error) {
      return new LoaderResultError(routeId, error);
    }
  }
}

/**
 * Loads data from the "global" loader, which lives in `data/global.js`.
 */
export async function loadGlobalData(
  config: RemixConfig,
  context: AppLoadContext,
  pathname: string,
  search: string
): Promise<LoaderResult> {
  let loader;
  try {
    loader = requireLoader(config, "global");
  } catch (error) {
    loader = null;
  }

  return executeLoader(loader, "global", context, pathname, search);
}

/**
 * Loads data for all the given routes.
 */
export function loadData(
  config: RemixConfig,
  context: AppLoadContext,
  pathname: string,
  search: string,
  matches: ConfigRouteMatch[]
): Promise<LoaderResult[]> {
  return Promise.all(
    matches.map(match =>
      loadRouteData(
        config,
        match.route.id,
        context,
        pathname,
        search,
        match.params
      )
    )
  );
}

export function loadRouteData(
  config: RemixConfig,
  routeId: string,
  context: AppLoadContext,
  pathname: string,
  search: string,
  params: Params
): Promise<LoaderResult> {
  let route = config.routeManifest[routeId];
  let loader = route.loaderFile
    ? requireLoader(config, route.loaderFile)
    : null;
  return executeLoader(loader, routeId, context, pathname, search, params);
}
