import path from "path";

import type { ConfigRoute } from "./defineRoutes";
import _defineRoutes from "./defineRoutes";
import getConventionalRoutes from "./getConventionalRoutes";

/**
 * The user-provided config in remix.config.js.
 */
export interface AppRemixConfig {
  paths: {
    /**
     * Relative path where the loaders are found.
     */
    loadersDirectory: string;

    /**
     * Relative path where the developer wants the server build to be saved.
     */
    serverBuildDirectory: string;

    /**
     * Relative path where the developer wants the client build to be saved
     */
    clientBuildDirectory: string;

    /**
     * URL prefix of the client build.
     */
    clientPublicPath: string;
  };

  /**
   * Configuration for the dev server.
   */
  devServer: {
    port: number;
  };

  routes: {
    (defineRoutes: typeof _defineRoutes): Promise<ConfigRoute[]>;
  };
}

/**
 * Combined config from the app's `remix.config.js` and the route config we use
 * throughout the server.
 */
export interface RemixConfig extends AppRemixConfig {
  appRoot: string;
  routesConfig: ConfigRoute[];
}

export async function readConfig(remixRoot?: string): Promise<RemixConfig> {
  let rootDir = remixRoot || process.env.REMIX_ROOT || process.cwd();
  let appRemixConfigFile = path.resolve(rootDir, "remix.config.js");
  let appRemixConfig: AppRemixConfig = require(appRemixConfigFile);

  // get routes
  let getRoutes = appRemixConfig.routes || (() => []);
  let conventionalRoutesDir = path.join(rootDir, "src", "routes");
  let appLoadersDir = path.join(rootDir, appRemixConfig.paths.loadersDirectory);
  let manualRoutes = await getRoutes(_defineRoutes);
  let conventionalRoutes = await getConventionalRoutes(
    conventionalRoutesDir,
    appLoadersDir
  );
  // validateRoutes(conventionalRoutes, manualRoutes);
  let routesConfig = [...conventionalRoutes, ...manualRoutes];

  return {
    ...appRemixConfig,
    appRoot: rootDir,
    routesConfig
  };
}

// function validateRoutes(conventionalRoutes, manualRoutes) {
//   // TODO: validateRoutes, make sure no dupes and stuff
// }
