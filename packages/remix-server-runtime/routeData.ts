import type { AppData } from "./data";

export interface RouteData {
  [routeId: string]: AppData;
}

export interface DeferredRouteData {
  [routeId: string]: Record<string | number, unknown>;
}
