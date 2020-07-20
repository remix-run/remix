import path from "path";

import defineRoutes, { ConfigRoute } from "./defineRoutes";
import getConventionalRoutes from "./getConventionalRoutes";

export interface ConfigPaths {
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
}

/**
 * Combined config from the app's `remix.config.js` and the route config we use
 * throughout the server.
 */
export interface AppRemixConfig {
  paths: ConfigPaths;
  routesConfig: ConfigRoute[];
}

export default async function readRemixConfig(
  root?: string
): Promise<AppRemixConfig> {
  let appRoot = root || process.env.REMIX_ROOT || process.cwd();
  let appRemixConfigPath = path.resolve("remix.config.js", appRoot);
  let appRemixConfig = await import(appRemixConfigPath);

  // get routes
  let getRoutes = appRemixConfig.routes || (() => []);
  let appRoutesDirPath = path.join(appRoot, "src", "routes");
  let appLoadersDirPath = path.join(
    appRoot,
    appRemixConfig.paths.loadersDirectory
  );
  let manualRoutes = await getRoutes({ defineRoutes });
  let conventionalRoutes = await getConventionalRoutes(
    appRoutesDirPath,
    appLoadersDirPath
  );
  // validateRoutes(conventionalRoutes, manualRoutes);
  let routesConfig = [...conventionalRoutes, ...manualRoutes];

  appRemixConfig.paths.appRoot = appRoot;

  // TODO: remove appRoot from root of config, it's already on paths.appRoot
  return {
    ...appRemixConfig,
    routesConfig
  };
}

// function validateRoutes(conventionalRoutes, manualRoutes) {
//   // TODO: validateRoutes, make sure no dupes and stuff
// }
