import type { Location } from "history";
import type { RouteData, RouteDataResults } from "@remix-run/core";

import invariant from "./invariant";

export interface DataCache {
  preload(location: Location, fromLocation: Location): Promise<void>;
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
    fromLocation: Location
  ): Promise<void> {
    if (cache[location.key]) return;

    if (inflight[location.key]) return;

    inflight[location.key] = fetchDataResults(
      location.pathname,
      fromLocation.pathname
    );

    try {
      let dataResults = await inflight[location.key];

      cache[location.key] = Object.keys(dataResults).reduce((memo, routeId) => {
        let dataResult = dataResults[routeId];

        if (dataResult.type === "data") {
          memo[routeId] = dataResult.data;
        } else if (dataResult.type === "copy") {
          memo[routeId] = cache[fromLocation.key][routeId];
        }

        return memo;
      }, {} as RouteData);
    } catch (error) {
      // TODO: Handle errors
      console.error(error);
    } finally {
      delete inflight[location.key];
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

async function fetchDataResults(
  path: string,
  from?: string
): Promise<RouteDataResults> {
  let url = `/__remix_data?path=${path}`;
  if (from) url += `&from=${from}`;
  let res = await fetch(url);
  return await res.json();
}
