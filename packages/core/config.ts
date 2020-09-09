import path from "path";

import type { ConfigRoute } from "./defineRoutes";
import _defineRoutes from "./defineRoutes";
import getConventionalRoutes from "./getConventionalRoutes";

/**
 * The user-provided config in remix.config.js.
 */
export interface AppRemixConfig {
  /**
   * Absolute path where the developer wants the client build to be saved
   */
  clientBuildDirectory: string;

  /**
   * URL prefix of the client build.
   */
  clientPublicPath: string;

  /**
   * Absolute path where the loaders are found.
   */
  loadersDirectory: string;

  /**
   * Absolute path to the root of the project.
   */
  rootDirectory: string;

  /**
   * Absolute path where the routes are found.
   */
  routesDirectory: string;

  routes: {
    (defineRoutes: typeof _defineRoutes): Promise<ConfigRoute[]>;
  };

  /**
   * Absolute path where the developer wants the server build to be saved.
   */
  serverBuildDirectory: string;

  /**
   * Configuration for the dev server.
   */
  devServerPort: number;
}

/**
 * Combined config from the app's `remix.config.js` and the route config we use
 * throughout the server.
 */
export interface RemixConfig extends Omit<AppRemixConfig, "routes"> {
  routesConfig: ConfigRoute[];
}

export async function readConfig(remixRoot?: string): Promise<RemixConfig> {
  if (!remixRoot) {
    remixRoot = process.env.REMIX_ROOT || process.cwd();
  }

  let rootDirectory = path.resolve(remixRoot);
  let configFile = path.resolve(rootDirectory, "remix.config.js");

  let appRemixConfig: AppRemixConfig;
  try {
    appRemixConfig = require(configFile);
  } catch (error) {
    throw new Error(`Missing remix.config.js in ${rootDirectory}`);
  }

  let clientBuildDirectory = path.resolve(
    rootDirectory,
    appRemixConfig.clientBuildDirectory || path.join("public", "build")
  );
  let clientPublicPath = path.resolve(
    rootDirectory,
    appRemixConfig.clientPublicPath || "/build/"
  );
  let devServerPort = appRemixConfig.devServerPort || 8002;
  let loadersDirectory = path.resolve(
    rootDirectory,
    appRemixConfig.loadersDirectory || "loaders"
  );
  let routesDirectory = path.resolve(
    rootDirectory,
    appRemixConfig.routesDirectory || path.join("src", "routes")
  );
  let serverBuildDirectory = path.resolve(
    rootDirectory,
    appRemixConfig.serverBuildDirectory || "build"
  );

  // get routes
  let getRoutes = appRemixConfig.routes || (() => []);
  let manualRoutes = await getRoutes(_defineRoutes);
  let conventionalRoutes = await getConventionalRoutes(
    routesDirectory,
    loadersDirectory
  );
  // validateRoutes(conventionalRoutes, manualRoutes);
  let routesConfig = [...conventionalRoutes, ...manualRoutes];

  let remixConfig: RemixConfig = {
    clientBuildDirectory,
    clientPublicPath,
    devServerPort,
    loadersDirectory,
    rootDirectory,
    routesDirectory,
    serverBuildDirectory,
    routesConfig
  };

  return remixConfig;
}

// function validateRoutes(conventionalRoutes, manualRoutes) {
//   // TODO: validateRoutes, make sure no dupes and stuff
// }
