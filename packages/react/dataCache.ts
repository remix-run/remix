import type { Location } from "history";
import type { Params } from "react-router";
import type { RouteData } from "@remix-run/core";

import type { ClientRouteMatch } from "./internals";
import invariant from "./invariant";

export interface DataCache {
  preload(
    prevLocation: Location,
    nextLocation: Location,
    prevMatches: ClientRouteMatch[],
    nextMatches: ClientRouteMatch[]
  ): Promise<void>;
  read(locationKey: string): RouteData;
  read(locationKey: string, routeId: string): RouteData[string];
}

export function createDataCache(
  initialKey: string,
  initialData: RouteData
): DataCache {
  let cache: { [locationKey: string]: RouteData } = {
    [initialKey]: initialData
  };

  let inflight: {
    [locationKey: string]: Promise<RouteData>;
  } = {};

  async function preload(
    prevLocation: Location,
    nextLocation: Location,
    prevMatches: ClientRouteMatch[],
    nextMatches: ClientRouteMatch[]
  ): Promise<void> {
    if (cache[nextLocation.key]) return;

    let cachedOrFetchedData = await Promise.all(
      nextMatches.map(match => {
        let prevMatch = prevMatches.find(
          prev => prev.pathname === match.pathname
        );
        return prevMatch && prevLocation.search === nextLocation.search
          ? read(prevLocation.key, match.route.id)
          : load(nextLocation, match.route.id, match.params);
      })
    );

    cache[nextLocation.key] = cachedOrFetchedData.reduce(
      (routeData, data, index) => {
        let match = nextMatches[index];
        routeData[match.route.id] = data;
        return routeData;
      },
      {} as RouteData
    );
  }

  async function load(location: Location, routeId: string, params: Params) {
    invariant(
      !(cache[location.key] && cache[location.key][routeId]),
      `Already loaded data for route ${routeId} on location ${location.key}`
    );

    let inflightKey = location.key + ":" + routeId;

    if (inflight[inflightKey]) {
      return inflight[inflightKey];
    }

    inflight[inflightKey] = fetchRouteData(location, routeId, params);

    try {
      let result = await inflight[inflightKey];
      return result.data;
    } catch (error) {
      console.error(error);
      // TODO: Show an error page
      return null;
    } finally {
      delete inflight[inflightKey];
    }
  }

  function read(locationKey: string, routeId?: string) {
    let locationData = cache[locationKey];

    invariant(locationData, `Missing data for location ${locationKey}`);

    if (!routeId) return locationData;

    invariant(
      locationData[routeId],
      `Missing data for route ${routeId} on location ${locationKey}`
    );

    return locationData[routeId];
  }

  return { preload, read };
}

interface RouteDataResult {
  data: any;
}

async function fetchRouteData(
  location: Location,
  routeId: string,
  params: Params
): Promise<RouteDataResult> {
  let search = createSearch({
    pathname: location.pathname,
    search: location.search,
    id: routeId,
    params: JSON.stringify(params)
  });
  let url = `/__remix_data${search}`;
  let res = await fetch(url);
  return await res.json();
}

function createSearch(pairs: { [paramName: string]: string }): string {
  let params = new URLSearchParams(pairs);
  return "?" + params.toString();
}
