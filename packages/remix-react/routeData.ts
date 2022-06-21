import type { AppData } from "./data";

export interface RouteData {
  [routeId: string]: AppData;
}

export interface DeferredRouteData {
  [routeId: string]: Record<string | number, Promise<unknown>>;
}

export interface DeferredRouteDataResolvers {
  [routeId: string]: Record<string | number, (resolve: unknown) => void>;
}
