import path from "path";
import { matchRoutes } from "react-router-dom";
import { RemixConfig } from "./readRemixConfig";

enum DataLoadStatus {
  NoMatch = "NO_MATCH",
  Success = "SUCCESS",
  NotFound = "NOT_FOUND",
  Error = "ERROR"
}

export interface SuccessLoadResult {
  data: any[];
  status: DataLoadStatus.Success;
}

export interface ErrorLoadResult {
  error: Error;
  status: DataLoadStatus.Error;
}

export interface NoMatchLoadResult {
  status: DataLoadStatus.NoMatch;
}

export type LoadResult =
  | SuccessLoadResult
  | NoMatchLoadResult
  | ErrorLoadResult;

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
) {
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

  let promises = loaders.map((loader, index) => {
    if (loader === null) {
      return null;
    } else {
      let params = matches[index].params;
      return loader({ params, context: loadContext, location });
    }
  });

  let results = await Promise.all(promises);
  return results.map((data, index) => {
    return { id: matches[index].route.id, data };
  });
}

// TODO: we probably want this to stream data as it becomes available to fully
// take advantage of suspense
export async function matchAndLoadData(
  remixConfig: RemixConfig,
  url: string,
  appLoadContext: any
): Promise<LoadResult> {
  let matches = matchRoutes(remixConfig.routesConfig, url);
  if (matches === null) throw new Error("Missing routes/404.js");

  let notFound = matches.length === 1 && matches[0].route.path === "*";
  if (notFound) {
    return { status: DataLoadStatus.NoMatch };
  }

  let location = createLocation(url);
  let data = await loadData(remixConfig, matches, appLoadContext, location);

  return {
    data,
    status: DataLoadStatus.Success
  };
}
