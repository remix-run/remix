import type { AppState } from "./errors";
import type { RouteManifest, EntryRoute } from "./routes";
import type { RouteData } from "./routeData";
import type { RouteMatch } from "./routeMatching";
import type { RouteModules } from "./routeModules";

export interface EntryContext {
  appState: AppState;
  manifest: AssetsManifest;
  matches: RouteMatch<EntryRoute>[];
  routeData: RouteData;
  actionData?: RouteData;
  routeModules: RouteModules;
  serverHandoffString?: string;
  future: FutureConfig;
}

export interface FutureConfig {
  v2_meta: boolean;
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
