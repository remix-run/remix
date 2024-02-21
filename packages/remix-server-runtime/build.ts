import type { ViteDevServer } from "vite";
import path from "pathe";

import type { ActionFunctionArgs, LoaderFunctionArgs } from "./routeModules";
import type { AssetsManifest, EntryContext, FutureConfig } from "./entry";
import type { ServerRouteManifest } from "./routes";
import type { AppLoadContext } from "./data";

export async function getServerBuild(
  buildPath: string,
  {
    viteDevServer,
  }: {
    viteDevServer?: ViteDevServer;
  } = {}
): Promise<ServerBuild | (() => Promise<ServerBuild>)> {
  if (viteDevServer) {
    return () =>
      viteDevServer.ssrLoadModule(
        "virtual:remix/server-build"
      ) as Promise<ServerBuild>;
  }

  if (!path.isAbsolute(buildPath)) {
    throw new Error(
      `Server build path must be absolute, but received relative path: ${buildPath}`
    );
  }

  // Convert file path meant for `import` to URL for Windows compatibility
  let buildURL = "file:///" + encodeURI(buildPath);
  return import(buildURL).catch(() => {
    throw Error(
      `Could not import server build from '${buildPath}'. Did you forget to run 'remix vite:build' first?`
    );
  });
}

// NOTE: IF you modify `ServerBuild`, be sure to modify the
// `remix-dev/server-build.ts` file to reflect the new field as well

/**
 * The output of the compiler for the server build.
 */
export interface ServerBuild {
  // v3 TODO:
  // - Deprecate when we deprecate the old compiler
  // - Remove in v3
  mode: string;
  entry: {
    module: ServerEntryModule;
  };
  routes: ServerRouteManifest;
  assets: AssetsManifest;
  basename?: string;
  publicPath: string;
  assetsBuildDirectory: string;
  future: FutureConfig;
  isSpaMode: boolean;
}

export interface HandleDocumentRequestFunction {
  (
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    context: EntryContext,
    loadContext: AppLoadContext
  ): Promise<Response> | Response;
}

export interface HandleDataRequestFunction {
  (response: Response, args: LoaderFunctionArgs | ActionFunctionArgs):
    | Promise<Response>
    | Response;
}

export interface HandleErrorFunction {
  (error: unknown, args: LoaderFunctionArgs | ActionFunctionArgs): void;
}

/**
 * A module that serves as the entry point for a Remix app during server
 * rendering.
 */
export interface ServerEntryModule {
  default: HandleDocumentRequestFunction;
  handleDataRequest?: HandleDataRequestFunction;
  handleError?: HandleErrorFunction;
}
