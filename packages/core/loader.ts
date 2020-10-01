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
  (args: { context: AppLoadContext; location: Location; params: Params }): any;
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
  location: Location,
  params: Params = {}
): Promise<LoaderResult> {
  if (loader == null) {
    return new LoaderResultSuccess(routeId, null);
  } else {
    try {
      let result = await loader({ context, location, params });

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
  location: Location
): Promise<LoaderResult> {
  let loader;
  try {
    loader = requireLoader(config, "global");
  } catch (error) {
    loader = null;
  }

  return executeLoader(loader, "global", context, location);
}

/**
 * Loads data for all the given routes.
 */
export async function loadData(
  config: RemixConfig,
  context: AppLoadContext,
  location: Location,
  matches: ConfigRouteMatch[]
): Promise<LoaderResult[]> {
  let loaders = matches.map(match =>
    match.route.loaderFile
      ? requireLoader(config, match.route.loaderFile)
      : null
  );

  let promises = loaders.map(
    async (loader, index): Promise<LoaderResult> =>
      executeLoader(
        loader,
        matches[index].route.id,
        context,
        location,
        matches[index].params
      )
  );

  let results = await Promise.all(promises);

  return results;
}

/**
 * Loads only the data for the new routes in a route transition. Data for routes
 * that have not changed are backfilled with "copy" results, indicating that
 * data for that route should be copied from the previous values that are
 * probably already cached somewhere (on the client).
 */
export async function loadDataDiff(
  config: RemixConfig,
  context: AppLoadContext,
  location: Location,
  matches: ConfigRouteMatch[],
  fromMatches: ConfigRouteMatch[]
): Promise<LoaderResult[]> {
  let newMatches = matches.filter(
    match =>
      !fromMatches.some(fromMatch => fromMatch.pathname === match.pathname)
  );
  let data = await loadData(config, context, location, newMatches);

  if (data.length < matches.length) {
    let copyMatches = matches.slice(0, matches.length - data.length);
    data.unshift(
      ...copyMatches.map(match => new LoaderResultCopy(match.route.id))
    );
  }

  return data;
}
