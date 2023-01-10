import type { StaticHandlerContext } from "@remix-run/router";

import type { RouteManifest, EntryRoute } from "./routes";
import type { RouteModules } from "./routeModules";

// Object passed to RemixContext.Provider
export interface RemixContextObject {
  manifest: AssetsManifest;
  routeModules: RouteModules;
  serverHandoffString?: string;
  future: FutureConfig;
}

// Additional React-Router information needed at runtime, but not hydrated
// through RemixContext
export interface EntryContext extends RemixContextObject {
  staticHandlerContext: StaticHandlerContext;
}

export interface FutureConfig {
  unstable_cssModules: boolean;
  unstable_cssSideEffectImports: boolean;
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
