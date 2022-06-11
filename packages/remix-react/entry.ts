import type { AppState } from "./errors";
import type { RouteManifest, EntryRoute } from "./routes";
import type {
  DeferredRouteData,
  DeferredRouteDataResolvers,
  RouteData,
} from "./routeData";
import type { RouteMatch } from "./routeMatching";
import type { RouteModules } from "./routeModules";

export interface EntryContext {
  appState: AppState;
  manifest: AssetsManifest;
  matches: RouteMatch<EntryRoute>[];
  routeData: RouteData;
  deferredRouteData: DeferredRouteData;
  deferredRouteDataResolvers: DeferredRouteDataResolvers;
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
