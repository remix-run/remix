import path from "path";
import type { Location } from "history";
import type { Params } from "react-router";

import type { RemixConfig } from "./config";
import {
  LoaderResult,
  LoaderResultChangeStatusCode,
  LoaderResultCopy,
  LoaderResultError,
  LoaderResultRedirect,
  LoaderResultSuccess
} from "./loaderResults";
import type { RemixRouteMatch } from "./match";
import { StatusCode, Redirect } from "./platform";

/**
 * An object of data returned from the server's `getLoadContext` function. This
 * will be passed to the loaders.
 */
export type AppLoadContext = any;

/**
 * A function that loads data for a route.
 */
export interface RemixLoader {
  ({
    context,
    location,
    params
  }: {
    context: AppLoadContext;
    location: Location;
    params: Params;
  }): any;
}

function getLoader(
  remixConfig: RemixConfig,
  match: RemixRouteMatch
): RemixLoader | null {
  if (match.route.loader == null) return null;

  let requirePath = path.resolve(
    remixConfig.loadersDirectory,
    match.route.loader
  );

  return require(requirePath);
}

/**
 * Loads data for all the given routes.
 */
export async function loadData(
  config: RemixConfig,
  matches: RemixRouteMatch[],
  location: Location,
  context: any
): Promise<LoaderResult[]> {
  let loaders = matches.map(match => getLoader(config, match));

  let promises = loaders.map(
    async (loader, index): Promise<LoaderResult> => {
      let id = matches[index].route.id;
      let params = matches[index].params;

      if (loader == null) {
        return new LoaderResultSuccess(id, null);
      } else {
        try {
          let result = await loader({ params, context, location });

          if (result instanceof StatusCode) {
            return new LoaderResultChangeStatusCode(id, result.status);
          } else if (result instanceof Redirect) {
            return new LoaderResultRedirect(
              id,
              result.location,
              result.permanent
            );
          }

          return new LoaderResultSuccess(id, result);
        } catch (error) {
          return new LoaderResultError(id, error);
        }
      }
    }
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
  matches: RemixRouteMatch[],
  fromMatches: RemixRouteMatch[],
  location: Location,
  context: any
): Promise<LoaderResult[]> {
  let newMatches = matches.filter(
    match =>
      !fromMatches.some(fromMatch => fromMatch.pathname === match.pathname)
  );

  let data = await loadData(config, newMatches, location, context);

  if (data.length < matches.length) {
    let copyMatches = matches.slice(0, matches.length - data.length);
    data.unshift(
      ...copyMatches.map(match => new LoaderResultCopy(match.route.id))
    );
  }

  return data;
}
