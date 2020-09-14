import path from "path";

import type { RemixRouteObject } from "./routes";
import { defineRoutes as _defineRoutes, getConventionalRoutes } from "./routes";

/**
 * The user-provided config in remix.config.js.
 */
export interface AppConfig {
  /**
   * The path to the client build, may be relative to remix.config.js.
   */
  clientBuildDirectory: string;

  /**
   * The URL prefix of the client build, may be relative to remix.config.js.
   */
  clientPublicPath: string;

  /**
   * The port number to use for the dev server.
   */
  devServerPort: number;

  /**
   * The path to the loaders, may be relative to remix.config.js.
   */
  loadersDirectory: string;

  /**
   * The path where "conventional" routes are found, may be relative to
   * the `sourceDirectory`. Conventional routes use the filesystem for defining
   * route paths and nesting.
   */
  routesDirectory: string;

  /**
   * A function for defining custom routes.
   */
  routes: {
    (defineRoutes: typeof _defineRoutes): Promise<RemixRouteObject[]>;
  };

  /**
   * The path to the server build, may be relative to remix.config.js.
   */
  serverBuildDirectory: string;

  /**
   * The path to the source directory, may be relative to remix.config.js.
   */
  sourceDirectory: string;
}

/**
 * Fully resolved configuration object we use throughout Remix.
 */
export interface RemixConfig {
  /**
   * The absolute path to the client build.
   */
  clientBuildDirectory: string;

  /**
   * The URL prefix of the client build.
   */
  clientPublicPath: string;

  /**
   * The port number to use for the dev server.
   */
  devServerPort: number;

  /**
   * The absolute path to the loaders.
   */
  loadersDirectory: string;

  /**
   * The absolute path to the root of the Remix project.
   */
  rootDirectory: string;

  /**
   * An array of all available routes, nested according to route hierarchy.
   */
  routes: RemixRouteObject[];

  /**
   * The absolute path to the server build.
   */
  serverBuildDirectory: string;

  /**
   * The absolute path to the source directory.
   */
  sourceDirectory: string;
}

/**
 * Returns a fully resolved config object from the remix.config.js in the given
 * root directory.
 */
export async function readConfig(remixRoot?: string): Promise<RemixConfig> {
  if (!remixRoot) {
    remixRoot = process.env.REMIX_ROOT || process.cwd();
  }

  let rootDirectory = path.resolve(remixRoot);
  let configFile = path.resolve(rootDirectory, "remix.config.js");

  let appConfig: AppConfig;
  try {
    appConfig = require(configFile);
  } catch (error) {
    throw new Error(`Missing remix.config.js in ${rootDirectory}`);
  }

  let clientBuildDirectory = path.resolve(
    rootDirectory,
    appConfig.clientBuildDirectory || path.join("public", "build")
  );

  let clientPublicPath = appConfig.clientPublicPath || "/build/";

  let devServerPort = appConfig.devServerPort || 8002;

  let loadersDirectory = path.resolve(
    rootDirectory,
    appConfig.loadersDirectory || "loaders"
  );

  let sourceDirectory = path.resolve(
    rootDirectory,
    appConfig.sourceDirectory || "src"
  );

  let routesDir = path.resolve(
    sourceDirectory,
    appConfig.routesDirectory || "routes"
  );
  let routes = await getConventionalRoutes(routesDir, loadersDirectory);
  if (appConfig.routes) {
    let manualRoutes = await appConfig.routes(_defineRoutes);
    routes.push(...manualRoutes);
  }

  let serverBuildDirectory = path.resolve(
    rootDirectory,
    appConfig.serverBuildDirectory || "build"
  );

  // TODO: validate routes

  let remixConfig: RemixConfig = {
    clientBuildDirectory,
    clientPublicPath,
    devServerPort,
    loadersDirectory,
    rootDirectory,
    routes,
    serverBuildDirectory,
    sourceDirectory
  };

  return remixConfig;
}
