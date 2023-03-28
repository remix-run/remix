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
  dev?: { port: number };
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

export interface FutureConfig {
  v2_dev: boolean | Dev;
  v2_headers: boolean;
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
