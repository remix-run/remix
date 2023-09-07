import type { StaticHandlerContext } from "@remix-run/router";

import type { RouteManifest, EntryRoute } from "./routes";
import type { RouteModules } from "./routeModules";

// Object passed to RemixContext.Provider

type SerializedError = {
  message: string;
  stack?: string;
};
export type RemixContextObject = {
  manifest: AssetsManifest;
  routeModules: RouteModules;
  serverHandoffString?: string;
  future: FutureConfig;
  abortDelay?: number;
  serializeError?(error: Error): SerializedError;
};

// Additional React-Router information needed at runtime, but not hydrated
// through RemixContext
export type EntryContext = RemixContextObject & {
  staticHandlerContext: StaticHandlerContext;
};

export type FutureConfig = {};

export type AssetsManifest = {
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
};
