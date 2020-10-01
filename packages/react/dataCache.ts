import type { Location } from "history";
import type { Params } from "react-router";
import type { RouteData } from "@remix-run/core";

import type { ClientRouteMatch } from "./internals";
import invariant from "./invariant";

export interface DataCache {
  preload(location: Location, match: ClientRouteMatch): Promise<void>;
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
    location: Location,
    match: ClientRouteMatch
  ): Promise<void> {
    let locationKey = location.key;
    let routeId = match.route.id;

    if (cache[locationKey] && cache[locationKey][routeId]) return;

    let inflightKey = locationKey + ":" + routeId;

    if (inflight[inflightKey]) return;

    inflight[inflightKey] = fetchRouteData(location, routeId, match.params);

    try {
      let result = await inflight[inflightKey];

      if (!cache[locationKey]) cache[locationKey] = {};

      cache[locationKey][routeId] = result.data;
    } catch (error) {
      // TODO: Handle errors
      console.error(error);
    } finally {
      delete inflight[locationKey];
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
