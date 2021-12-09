import type { AppState } from "./errors";
import type { RouteData } from "./routeData";
import type { RouteMatch } from "./routeMatching";
import type { RouteModules } from "./routeModules";
import type { EntryRoute, RouteManifest } from "./routes";

export interface EntryContext {
  appState: AppState;
  manifest: AssetsManifest;
  matches: RouteMatch<EntryRoute>[];
  routeData: RouteData;
  actionData?: RouteData;
  routeModules: RouteModules;
  serverHandoffString?: string;
}

export interface AssetsManifest {
  entry: {
    imports: string[];
    module: string;
  };
  routes: RouteManifest<EntryRoute>;
  url: string;
  version: string;
}
