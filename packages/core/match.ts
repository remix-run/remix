import path from "path";
import { matchRoutes } from "react-router-dom";

import type { RemixConfig } from "./config";
import type { Request } from "./platform";

enum DataLoadStatus {
  Success = "SUCCESS",
  NotFound = "NOT_FOUND",
  Error = "ERROR"
}

export interface SuccessLoadResult {
  status: DataLoadStatus.Success;
  id: string;
  data: any[] | null;
}

export interface ErrorLoadResult {
  status: DataLoadStatus.Error;
  id: string;
  error: string;
}

export type LoadResult = SuccessLoadResult | ErrorLoadResult;

export type MatchAndLoadResult = LoadResult[] | null;

type Location = {
  pathname: string;
  search: string;
};

// TODO: extend React Router's RouteMatch
type RouteMatch = {
  route: {
    loader: string | null;
    path: string;
    id: string;
  };
  params: {};
};

// TODO: Does history/react router have something here?
function createLocation(url: string) {
  let [pathname, search] = url.split("?");
  return { pathname, search };
}

async function loadData(
  remixConfig: RemixConfig,
  matches: RouteMatch[],
  loadContext: any,
  location: Location
): Promise<LoadResult[]> {
  let loaders = matches.map(match => {
    if (match.route.loader === null) {
      return null;
    }

    // TODO: maybe resolve this stuff at initialization instead
    let modulePath = path.resolve(
      remixConfig.appRoot,
      remixConfig.paths.loadersDirectory,
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
        return { status: DataLoadStatus.Success, id, data: null };
      } else {
        try {
          let data = await loader({ params, context: loadContext, location });
          return { status: DataLoadStatus.Success, id, data };
        } catch (error) {
          return { status: DataLoadStatus.Error, id, error: error.message };
        }
      }
    }
  );

  let results = await Promise.all(promises);

  return results;
}

type fixme = any;

// TODO: we probably want this to stream data as it becomes available to fully
// take advantage of suspense
export async function matchAndLoadData(
  remixConfig: RemixConfig,
  req: Request,
  loadContext: any
): Promise<MatchAndLoadResult> {
  let matches = matchRoutes(remixConfig.routesConfig as fixme, req.url);

  // TODO: Maybe warn the user about missing 404 when we first validate their
  // routes config instead of waiting until now...
  if (matches === null) throw new Error("Missing routes/404.js");

  let notFound = matches.length === 1 && matches[0].route.path === "*";
  if (notFound) return null;

  let location = createLocation(req.url);

  return await loadData(remixConfig, matches as fixme, loadContext, location);
}
