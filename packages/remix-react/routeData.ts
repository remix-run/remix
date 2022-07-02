import type { AppData } from "./data";

export interface RouteData {
  [jsonPropertyName: string]: AppData;
}
