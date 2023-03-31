import type { StaticHandlerContext } from "@remix-run/router";

import type { RouteManifest, EntryRoute } from "./routes";
import type { RouteModules } from "./routeModules";

// Object passed to RemixContext.Provider
export interface RemixContextObject {
  manifest: AssetsManifest;
  routeModules: RouteModules;
  serverHandoffString?: string;
  future: FutureConfig;
  abortDelay?: number;
  dev?: { liveReloadPort: number };
}

// Additional React-Router information needed at runtime, but not hydrated
// through RemixContext
export interface EntryContext extends RemixContextObject {
  staticHandlerContext: StaticHandlerContext;
}

type Dev = {
  port?: number;
  appServerPort?: number;
  remixRequestHandlerPath?: string;
  rebuildPollIntervalMs?: number;
};

type VanillaExtractOptions = {
  cache?: boolean;
};

export interface FutureConfig {
  unstable_cssModules: boolean;
  unstable_cssSideEffectImports: boolean;
  unstable_dev: boolean | Dev;
  unstable_postcss: boolean;
  unstable_tailwind: boolean;
  unstable_vanillaExtract: boolean | VanillaExtractOptions;
  v2_errorBoundary: boolean;
  v2_meta: boolean;
  v2_normalizeFormMethod: boolean;
  v2_routeConvention: boolean;
}

export interface AssetsManifest {
  entry: {
    imports: string[];
    module: string;
  };
  routes: RouteManifest<EntryRoute>;
  url: string;
  version: string;
  hmr?: {
    timestamp: number;
    runtime: string;
  };
}
