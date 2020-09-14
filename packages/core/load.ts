import path from "path";
import type { Location } from "history";
import type { Params } from "react-router";

import type { RemixConfig } from "./config";
import type { RemixRouteMatch } from "./match";

export type AppLoadContext = any;

export enum LoaderResultStatus {
  Copy = "COPY",
  Success = "SUCCESS",
  Error = "ERROR"
}

export interface LoaderResultCopy {
  status: LoaderResultStatus.Copy;
  id: string;
  params: Params;
}

export interface LoaderResultSuccess {
  status: LoaderResultStatus.Success;
  id: string;
  data: any;
  params: Params;
}

export interface LoaderResultError {
  status: LoaderResultStatus.Error;
  id: string;
  error: string;
  params: Params;
}

export type LoaderResult =
  | LoaderResultCopy
  | LoaderResultSuccess
  | LoaderResultError;

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
      let copyData: LoaderResultCopy[] = copyMatches.map(match => ({
        status: LoaderResultStatus.Copy,
        id: match.route.id,
        params: match.params
      }));

      data.unshift(...copyData);
    }

    return data;
  }

  return await loadDataForMatches(remixConfig, matches, loadContext, location);
}

async function loadDataForMatches(
  remixConfig: RemixConfig,
  matches: RemixRouteMatch[],
  loadContext: any,
  location: Location
): Promise<LoaderResult[]> {
  let loaders = matches.map(match => getLoader(remixConfig, match));

  let promises = loaders.map(
    async (loader, index): Promise<LoaderResult> => {
      let id = matches[index].route.id;
      let params = matches[index].params;

      if (loader == null) {
        return { status: LoaderResultStatus.Success, id, data: null, params };
      } else {
        try {
          let data = await loader({ params, context: loadContext, location });
          return { status: LoaderResultStatus.Success, id, data, params };
        } catch (error) {
          return {
            status: LoaderResultStatus.Error,
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
