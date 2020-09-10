import path from "path";
import type { RouteMatch, RouteObject, Params } from "react-router";
import { matchRoutes } from "react-router";

import type { RemixConfig, ConfigRoute } from "./config";

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

// interface RemixRouteObject extends Omit<RouteObject, "element"> {
//   id: string;
//   loader: string | null;
// }

interface RemixRouteMatch extends Omit<RouteMatch, "route"> {
  // route: RemixRouteObject;
  route: ConfigRoute;
  params: {};
}

// TODO: Does history/react router have something here?
function createLocation(url: string) {
  let [pathname, search] = url.split("?");
  return { pathname, search };
}

async function loadData(
  remixConfig: RemixConfig,
  matches: RemixRouteMatch[],
  loadContext: any,
  location: Location
): Promise<LoadResult[]> {
  let loaders = matches.map(match => {
    if (match.route.loader === null) {
      return null;
    }

    // TODO: maybe resolve this stuff at initialization instead
    let modulePath = path.resolve(
      remixConfig.loadersDirectory,
      match.route.loader
    );
    let requirePath = path.relative(__dirname, modulePath);
    return require(requirePath);
  });

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

// type fixme = any;

function _matchRoutes(routes: ConfigRoute[], url: string) {
  return matchRoutes(routes as RouteObject[], url) as RemixRouteMatch[] | null;
}

// TODO: we probably want this to stream data as it becomes available to fully
// take advantage of suspense
export async function matchAndLoadData(
  remixConfig: RemixConfig,
  url: string,
  loadContext: any,
  from: string | null = null
): Promise<MatchAndLoadResult> {
  // let routes = remixConfig.routesConfig.map()
  let matches = _matchRoutes(remixConfig.routesConfig, url);

  // TODO: Maybe warn the user about missing 404 when we first validate their
  // routes config instead of waiting until now...
  if (matches == null) throw new Error("Missing routes/404.js");

  let notFound = matches.length === 1 && matches[0].route.path === "*";
  if (notFound) return null;

  let location = createLocation(url);

  if (from) {
    // Try to load data for only the new routes!
    let fromMatches = _matchRoutes(remixConfig.routesConfig, from);

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
