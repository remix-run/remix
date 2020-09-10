import path from "path";
import type { RouteMatch, RouteObject, Params } from "react-router";
import { matchRoutes } from "react-router";

import type { RemixConfig } from "./config";
import type { RemixRouteObject } from "./routes";

enum DataLoadStatus {
  Copy = "COPY",
  Success = "SUCCESS",
  Error = "ERROR"
}

export interface CopyLoadResult {
  status: DataLoadStatus.Copy;
  id: string;
  params: Params;
}

export interface SuccessLoadResult {
  status: DataLoadStatus.Success;
  id: string;
  data: any[] | null;
  params: Params;
}

export interface ErrorLoadResult {
  status: DataLoadStatus.Error;
  id: string;
  error: string;
  params: Params;
}

export type LoadResult = CopyLoadResult | SuccessLoadResult | ErrorLoadResult;

export type MatchAndLoadResult = LoadResult[] | null;

type Location = {
  pathname: string;
  search: string;
};

// TODO: Does history/react router have something here?
function createLocation(url: string) {
  let [pathname, search] = url.split("?");
  return { pathname, search };
}

// TODO: we probably want this to stream data as it becomes available to fully
// take advantage of suspense
export async function matchAndLoadData(
  remixConfig: RemixConfig,
  url: string,
  loadContext: any,
  from: string | null = null
): Promise<MatchAndLoadResult> {
  let matches = matchRemixRoutes(remixConfig.routes, url);

  // TODO: Maybe warn the user about missing 404 when we first validate their
  // routes config instead of waiting until now...
  if (matches == null) throw new Error("Missing routes/404.js");

  let notFound = matches.length === 1 && matches[0].route.path === "*";
  if (notFound) return null;

  let location = createLocation(url);

  if (from) {
    // Try to load data for only the new routes!
    let fromMatches = matchRemixRoutes(remixConfig.routes, from);

    if (fromMatches) {
      let newMatches = matches.filter(
        match =>
          !fromMatches!.some(fromMatch => fromMatch.pathname === match.pathname)
      );

      let data = await loadData(remixConfig, newMatches, loadContext, location);

      if (data.length < matches.length) {
        let copyMatches = matches.slice(0, matches.length - data.length);
        let copyData = copyMatches.map(match => ({
          status: DataLoadStatus.Copy,
          id: match.route.id,
          params: match.params
        }));

        // @ts-ignore
        data.unshift(...copyData);
      }

      return data;
    }
  }

  return await loadData(remixConfig, matches, loadContext, location);
}

export interface RemixRouteMatch extends Omit<RouteMatch, "route"> {
  route: RemixRouteObject;
}

function matchRemixRoutes(
  routes: RemixRouteObject[],
  url: string
): RemixRouteMatch[] | null {
  return matchRoutes((routes as unknown) as RouteObject[], url) as
    | RemixRouteMatch[]
    | null;
}

async function loadData(
  remixConfig: RemixConfig,
  matches: RemixRouteMatch[],
  loadContext: any,
  location: Location
): Promise<LoadResult[]> {
  let loaders = matches.map(match =>
    getLoader(remixConfig.loadersDirectory, match)
  );

  let promises = loaders.map(
    async (loader, index): Promise<LoadResult> => {
      let id = matches[index].route.id;
      let params = matches[index].params;

      if (loader == null) {
        return { status: DataLoadStatus.Success, id, data: null, params };
      } else {
        try {
          let data = await loader({ params, context: loadContext, location });
          return { status: DataLoadStatus.Success, id, data, params };
        } catch (error) {
          return {
            status: DataLoadStatus.Error,
            id,
            error: error.message,
            params
          };
        }
      }
    }
  );

  let results = await Promise.all(promises);

  return results;
}

export type LoadContext = any;

export interface RemixLoader {
  ({
    params,
    context,
    location
  }: {
    params: Params;
    context: LoadContext;
    location: Location;
  }): any;
}

function getLoader(
  loadersDirectory: string,
  match: RemixRouteMatch
): RemixLoader | null {
  if (match.route.loader == null) return null;
  let requirePath = path.resolve(loadersDirectory, match.route.loader);
  return require(requirePath);
}
