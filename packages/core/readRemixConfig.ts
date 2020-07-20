import path from "path";

import _defineRoutes, { ConfigRoute } from "./defineRoutes";
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

export default async function readRemixConfig(
  root?: string
): Promise<RemixConfig> {
  let appRoot = root || process.env.REMIX_ROOT || process.cwd();
  let appRemixConfigPath = path.resolve(appRoot, "remix.config.js");
  let appRemixConfig: AppRemixConfig = await import(appRemixConfigPath);

  // get routes
  let getRoutes = appRemixConfig.routes || (() => []);
  let appRoutesDirPath = path.join(appRoot, "src", "routes");
  let appLoadersDirPath = path.join(
    appRoot,
    appRemixConfig.paths.loadersDirectory
  );
  let manualRoutes = await getRoutes(_defineRoutes);
  let conventionalRoutes = await getConventionalRoutes(
    appRoutesDirPath,
    appLoadersDirPath
  );
  // validateRoutes(conventionalRoutes, manualRoutes);
  let routesConfig = [...conventionalRoutes, ...manualRoutes];

  return {
    ...appRemixConfig,
    appRoot,
    routesConfig
  };
}

// function validateRoutes(conventionalRoutes, manualRoutes) {
//   // TODO: validateRoutes, make sure no dupes and stuff
// }
