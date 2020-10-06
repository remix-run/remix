import type { Location } from "history";
import type { Params } from "react-router";
import type { AppData, RouteData } from "@remix-run/core";

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
    [locationKey: string]: Promise<AppData>;
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

  async function load(
    location: Location,
    routeId: string,
    params: Params
  ): Promise<AppData> {
    invariant(
      !cache[location.key],
      `Already loaded data for location ${location.key}`
    );

    invariant(
      !(cache[location.key] && routeId in cache[location.key]),
      `Already loaded data for route ${routeId} on location ${location.key}`
    );

    let inflightKey = location.key + ":" + routeId;

    if (inflight[inflightKey]) {
      return inflight[inflightKey];
    }

    inflight[inflightKey] = fetchDataForRoute(location, routeId, params);

    try {
      return await inflight[inflightKey];
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      delete inflight[inflightKey];
    }
  }

  function read(locationKey: string, routeId?: string) {
    let locationData = cache[locationKey];

    invariant(locationData, `Missing data for location ${locationKey}`);

    if (!routeId) return locationData;

    invariant(
      locationData[routeId] !== undefined,
      `Missing data for route ${routeId} on location ${locationKey}`
    );

    return locationData[routeId];
  }

  return { preload, read };
}

async function fetchDataForRoute(
  location: Location,
  routeId: string,
  routeParams: Params
): Promise<AppData> {
  let url = new URL(
    location.pathname + location.search,
    window.location.origin
  );
  let params = new URLSearchParams({
    url: url.toString(),
    id: routeId,
    params: JSON.stringify(routeParams)
  });
  let res = await fetch(`/__remix_data?${params.toString()}`);
  let contentType = res.headers.get("Content-Type");

  if (contentType && /\bapplication\/json\b/.test(contentType)) {
    return res.json();
  }

  return res.text();
}
