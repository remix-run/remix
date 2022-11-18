import type { AppState } from "./errors";
import type {
  RouteManifest,
  ServerRouteManifest,
  EntryRoute,
  ServerRoute,
} from "./routes";
import type { RouteData } from "./routeData";
import type { RouteMatch } from "./routeMatching";
import type { RouteModules, EntryRouteModule } from "./routeModules";

export interface EntryContext {
  appState: AppState;
  manifest: AssetsManifest;
  matches: RouteMatch<EntryRoute>[];
  routeData: RouteData;
  actionData?: RouteData;
  routeModules: RouteModules<EntryRouteModule>;
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

export function createEntryMatches(
  matches: RouteMatch<ServerRoute>[],
  routes: RouteManifest<EntryRoute>
): RouteMatch<EntryRoute>[] {
  return matches.map((match) => ({
    params: match.params,
    pathname: match.pathname,
    route: routes[match.route.id],
  }));
}

export function createEntryRouteModules(
  manifest: ServerRouteManifest
): RouteModules<EntryRouteModule> {
  return Object.keys(manifest).reduce((memo, routeId) => {
    memo[routeId] = manifest[routeId].module;
    return memo;
  }, {} as RouteModules<EntryRouteModule>);
}
