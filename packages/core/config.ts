import path from "path";

import type { RemixRouteObject } from "./routes";
import { defineRoutes as _defineRoutes, getConventionalRoutes } from "./routes";

/**
 * The user-provided config in remix.config.js.
 */
export interface UserConfig {
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
   * remix.config.js. Conventional routes use the filesystem for defining
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

  let userConfig: UserConfig;
  try {
    userConfig = require(configFile);
  } catch (error) {
    throw new Error(`Missing remix.config.js in ${rootDirectory}`);
  }

  let clientBuildDirectory = path.resolve(
    rootDirectory,
    userConfig.clientBuildDirectory || path.join("public", "build")
  );

  let clientPublicPath = userConfig.clientPublicPath || "/build/";

  let devServerPort = userConfig.devServerPort || 8002;

  let loadersDirectory = path.resolve(
    rootDirectory,
    userConfig.loadersDirectory || "loaders"
  );

  let routesDir = path.resolve(
    rootDirectory,
    userConfig.routesDirectory || path.join("src", "routes")
  );
  let routes = await getConventionalRoutes(routesDir, loadersDirectory);
  if (userConfig.routes) {
    let manualRoutes = await userConfig.routes(_defineRoutes);
    routes.push(...manualRoutes);
  }

  let serverBuildDirectory = path.resolve(
    rootDirectory,
    userConfig.serverBuildDirectory || "build"
  );

  // TODO: validate routes

  let remixConfig: RemixConfig = {
    clientBuildDirectory,
    clientPublicPath,
    devServerPort,
    loadersDirectory,
    rootDirectory,
    routes,
    serverBuildDirectory
  };

  return remixConfig;
}
