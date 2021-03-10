import path from "path";
import type { MdxOptions } from "@mdx-js/mdx";

import { loadModule } from "./modules";
import type { ConfigRoute, DefineRoutesFunction } from "./config/routes";
import { defineRoutes } from "./config/routes";
import { defineConventionalRoutes } from "./config/routesConvention";
import type { RouteManifest } from "./config/routesManifest";
import { createRouteManifest } from "./config/routesManifest";
import { ServerMode, isValidServerMode } from "./config/serverModes";

/**
 * The user-provided config in `remix.config.js`.
 */
export interface AppConfig {
  /**
   * The path to the `app` directory, relative to `remix.config.js`. Defaults to
   * "app".
   */
  appDirectory?: string;

  /**
   * The path to a directory Remix can use for caching things in development,
   * relative to `remix.config.js`. Defaults to ".cache".
   */
  cacheDirectory?: string;

  /**
   * A function for defining custom routes, in addition to those already defined
   * using the filesystem convention in `app/routes`.
   */
  routes?: (
    defineRoutes: DefineRoutesFunction
  ) => Promise<ReturnType<DefineRoutesFunction>>;

  /**
   * The path to the server build, relative to `remix.config.js`. Defaults to
   * "build".
   */
  serverBuildDirectory?: string;

  /**
   * The path to the browser build, relative to `remix.config.js`. Defaults to
   * "public/build".
   */
  assetsBuildDirectory?: string;

  /**
   * The path to the browser build, relative to remix.config.js. Defaults to
   * "public/build".
   *
   * @deprecated Use `assetsBuildDirectory` instead
   */
  browserBuildDirectory?: string;

  /**
   * The URL prefix of the browser build with a trailing slash. Defaults to
   * "/build/".
   */
  publicPath?: string;

  /**
   * The port number to use for the dev server. Defaults to 8002.
   */
  devServerPort?: number;

  /**
   * Options to use when compiling MDX.
   */
  mdx?: MdxOptions;
}

/**
 * Fully resolved configuration object we use throughout Remix.
 */
export interface RemixConfig {
  /**
   * The absolute path to the root of the Remix project.
   */
  rootDirectory: string;

  /**
   * The absolute path to the source directory.
   */
  appDirectory: string;

  /**
   * The absolute path to the cache directory.
   */
  cacheDirectory: string;

  /**
   * An array of all available routes, nested according to route hierarchy.
   */
  routes: ConfigRoute[];

  /**
   * An object of all available routes, keyed by id.
   */
  routeManifest: RouteManifest;

  /**
   * The absolute path to the server build directory.
   */
  serverBuildDirectory: string;

  /**
   * The absolute path to the assets build directory.
   */
  assetsBuildDirectory: string;

  /**
   * The URL prefix of the public build with a trailing slash.
   */
  publicPath: string;

  /**
   * The mode to use to run the server.
   */
  serverMode: ServerMode;

  /**
   * The port number to use for the dev (asset) server.
   */
  devServerPort: number;

  /**
   * Options to use when compiling MDX.
   */
  mdx?: MdxOptions;
}

/**
 * Returns a fully resolved config object from the remix.config.js in the given
 * root directory.
 */
export async function readConfig(
  remixRoot?: string,
  serverMode = ServerMode.Production
): Promise<RemixConfig> {
  if (!remixRoot) {
    remixRoot = process.env.REMIX_ROOT || process.cwd();
  }

  if (!isValidServerMode(serverMode)) {
    throw new Error(`Invalid server mode "${serverMode}"`);
  }

  let rootDirectory = path.resolve(remixRoot);
  let appConfigFile = path.resolve(rootDirectory, "remix.config.js");

  let appConfig: AppConfig;
  try {
    appConfig = loadModule(appConfigFile);
  } catch (error) {
    console.error(`Error loading Remix config in ${appConfigFile}`);
    console.error(error);
  }

  let appDirectory = path.resolve(
    rootDirectory,
    appConfig.appDirectory || "app"
  );

  let cacheDirectory = path.resolve(
    rootDirectory,
    appConfig.cacheDirectory || ".cache"
  );

  let serverBuildDirectory = path.resolve(
    rootDirectory,
    appConfig.serverBuildDirectory || "build"
  );

  let assetsBuildDirectory = path.resolve(
    rootDirectory,
    appConfig.assetsBuildDirectory ||
      appConfig.browserBuildDirectory ||
      path.join("public", "build")
  );

  let devServerPort = appConfig.devServerPort || 8002;

  let publicPath = addTrailingSlash(appConfig.publicPath || "/build/");

  let routes = defineConventionalRoutes(appDirectory);
  if (appConfig.routes) {
    let manualRoutes = await appConfig.routes(defineRoutes);
    for (let shallowRoute of manualRoutes) {
      shallowRoute.parentId = "root";
    }
    let root = routes[0];
    (root.children || (root.children = [])).push(...manualRoutes);
  }

  let routeManifest = createRouteManifest(routes);

  // TODO: validate routes

  let remixConfig: RemixConfig = {
    appDirectory,
    cacheDirectory,
    devServerPort,
    mdx: appConfig.mdx,
    assetsBuildDirectory,
    publicPath,
    rootDirectory,
    routes,
    routeManifest,
    serverBuildDirectory,
    serverMode
  };

  return remixConfig;
}

function addTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : path + "/";
}
