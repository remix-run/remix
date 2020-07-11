import path from "path";

import defineRoutes from "./defineRoutes";
import getConventionalRoutes from "./getConventionalRoutes";

/* TODO: these don't work yet ... not sure why */

/**
 * @typedef {Object} ConfigPaths
 * @property {string} loadersDirectory - relative path where the loaders are found
 * @property {string} serverBuildDirectory - relative path where the developer wants the server build to be saved
 * @property {string} clientBuildDirectory - relative path where the developer wants the client build to be saved
 * @property {string} clientPublicPath - URL prefix of the client build
 */

/**
 * @typedef {Object} AppRemixConfig - Combined config from the app's `remix.config.js` and the route config we use throughout the server.
 * @property {string} appRoot - DEPRECATED: use paths.appRoot
 * @property {ConfigPaths} paths
 * @property {import("./defineRoutes").ConfigRoute[]} routesConfig
 */

/**
 * @returns {PromiseLike<AppRemixConfig>}
 */
async function readRemixConfig(root) {
  let appRoot = root || process.env.REMIX_ROOT || process.cwd();
  let appRemixConfigPath = path.join(appRoot, "remix.config.js");
  let appRemixConfig = require(appRemixConfigPath);

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
  validateRoutes(conventionalRoutes, manualRoutes);
  let routesConfig = [...conventionalRoutes, ...manualRoutes];

  appRemixConfig.paths.appRoot = appRoot;

  // TODO: remove appRoot from root of config, it's already on paths.appRoot
  return {
    appRoot,
    ...appRemixConfig,
    routesConfig
  };
}

module.exports = readRemixConfig;

function validateRoutes(conventionalRoutes, manualRoutes) {
  // TODO: validateRoutes, make sure no dupes and stuff
}
