import path from "path";
import type { Location } from "history";
import type { Params } from "react-router";

import type { RemixConfig } from "./config";
import type { RemixRouteMatch } from "./match";
import { StatusCode, Redirect } from "./platform";

export type AppLoadContext = any;

export class LoaderResult {
  readonly routeId: string;
  readonly httpStatus: number;
  constructor(routeId: string, httpStatus = 200) {
    this.routeId = routeId;
    this.httpStatus = httpStatus;
  }
}

export class LoaderResultChangeStatusCode extends LoaderResult {
  toJSON() {
    return {
      type: "changeStatusCode",
      routeId: this.routeId,
      httpStatus: this.httpStatus
    };
  }
}

export class LoaderResultCopy extends LoaderResult {
  toJSON() {
    return {
      type: "copy",
      routeId: this.routeId
    };
  }
}

export class LoaderResultError extends LoaderResult {
  readonly error: Error;
  constructor(routeId: string, error: Error) {
    super(routeId, 500);
    this.error = error;
  }
  toJSON() {
    return {
      type: "error",
      routeId: this.routeId,
      error: this.error.message,
      stack: this.error.stack
    };
  }
}

export class LoaderResultRedirect extends LoaderResult {
  readonly location: string;
  constructor(routeId: string, location: string, httpStatus = 302) {
    super(routeId, httpStatus);
    this.location = location;
  }
  toJSON() {
    return {
      type: "redirect",
      routeId: this.routeId,
      httpStatus: this.httpStatus,
      location: this.location
    };
  }
}

export class LoaderResultSuccess extends LoaderResult {
  readonly data: any;
  constructor(routeId: string, data: any) {
    super(routeId);
    this.data = data;
  }
  toJSON() {
    return {
      type: "success",
      routeId: this.routeId,
      data: this.data
    };
  }
}

// TODO: we probably want this to stream data as it becomes available to fully
// take advantage of suspense
export async function loadData(
  remixConfig: RemixConfig,
  matches: RemixRouteMatch[],
  fromMatches: RemixRouteMatch[] | null = null,
  loadContext: AppLoadContext,
  location: Location
): Promise<LoaderResult[]> {
  if (fromMatches) {
    // Try to load data for only the new routes!
    let newMatches = matches.filter(
      match =>
        !fromMatches!.some(fromMatch => fromMatch.pathname === match.pathname)
    );

    let data = await loadDataForMatches(
      remixConfig,
      newMatches,
      loadContext,
      location
    );

    if (data.length < matches.length) {
      let copyMatches = matches.slice(0, matches.length - data.length);
      data.unshift(
        ...copyMatches.map(match => new LoaderResultCopy(match.route.id))
      );
    }

    return data;
  }

  return await loadDataForMatches(remixConfig, matches, loadContext, location);
}

async function loadDataForMatches(
  remixConfig: RemixConfig,
  matches: RemixRouteMatch[],
  context: any,
  location: Location
): Promise<LoaderResult[]> {
  let loaders = matches.map(match => getLoader(remixConfig, match));

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
            return new LoaderResultRedirect(id, result.location, result.status);
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

export interface RemixLoader {
  ({
    params,
    context,
    location
  }: {
    params: Params;
    context: AppLoadContext;
    location: Location;
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
