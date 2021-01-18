import path from "path";
import type { MdxOptions } from "@mdx-js/mdx";

import type { ConfigRouteObject, RouteManifest, DefineRoutes } from "./routes";
import { createRouteManifest, defineRoutes } from "./routes";
import { defineConventionalRoutes } from "./routesConvention";

/**
 * The mode to use when running the server.
 */
export enum ServerMode {
  Development = "development",
  Production = "production",
  Test = "test"
}

/**
 * The user-provided config in remix.config.js.
 */
export interface AppConfig {
  /**
   * The path to the `app` directory, relative to remix.config.js. Defaults to
   * "app".
   */
  appDirectory?: string;

  /**
   * A function for defining custom routes, in addition to those already defined
   * using the filesystem convention in `app/routes`.
   */
  routes?: (defineRoutes: DefineRoutes) => Promise<ReturnType<DefineRoutes>>;

  /**
   * The path to the browser build, relative to remix.config.js. Defaults to
   * "public/build".
   */
  browserBuildDirectory?: string;

  /**
   * The URL prefix of the browser build with a trailing slash. Defaults to
   * "/build/".
   */
  publicPath?: string;

  /**
   * The path to the server build, relative to remix.config.js. Defaults to
   * "build".
   */
  serverBuildDirectory?: string;

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
   * An array of all available routes, nested according to route hierarchy.
   */
  routes: ConfigRouteObject[];

  /**
   * An object of all available routes, keyed by id.
   */
  routeManifest: RouteManifest;

  /**
   * The absolute path to the browser build.
   */
  browserBuildDirectory: string;

  /**
   * The URL prefix of the browser build with a trailing slash.
   */
  publicPath: string;

  /**
   * The absolute path to the server build.
   */
  serverBuildDirectory: string;

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
  serverMode: string = ServerMode.Production
): Promise<RemixConfig> {
  if (!remixRoot) {
    remixRoot = process.env.REMIX_ROOT || process.cwd();
  }

  if (!isValidServerMode(serverMode)) {
    throw new Error(`Invalid server mode "${serverMode}"`);
  }

  let rootDirectory = path.resolve(remixRoot);
  let configFile = path.resolve(rootDirectory, "remix.config.js");

  let appConfig: AppConfig;
  try {
    appConfig = require(configFile);
  } catch (error) {
    throw new Error(`Missing remix.config.js in ${rootDirectory}`);
  }

  let appDirectory = path.resolve(
    rootDirectory,
    appConfig.appDirectory || "app"
  );

  let browserBuildDirectory = path.resolve(
    rootDirectory,
    appConfig.browserBuildDirectory || path.join("public", "build")
  );

  let devServerPort = appConfig.devServerPort || 8002;

  let publicPath = addTrailingSlash(appConfig.publicPath || "/build/");

  let routes = defineConventionalRoutes(appDirectory);
  if (appConfig.routes) {
    let manualRoutes = await appConfig.routes(defineRoutes);
    for (let shallowRoute of manualRoutes) {
      shallowRoute.parentId = "layout:root";
    }
    let root = routes[0];
    (root.children || (root.children = [])).push(...manualRoutes);
  }

  let routeManifest = createRouteManifest(routes);

  let serverBuildDirectory = path.resolve(
    rootDirectory,
    appConfig.serverBuildDirectory || "build"
  );

  // TODO: validate routes

  let remixConfig: RemixConfig = {
    appDirectory,
    browserBuildDirectory,
    devServerPort,
    mdx: appConfig.mdx,
    publicPath,
    rootDirectory,
    routes,
    routeManifest,
    serverBuildDirectory,
    serverMode
  };

  return remixConfig;
}

function isValidServerMode(serverMode: string): serverMode is ServerMode {
  return (
    serverMode === ServerMode.Development ||
    serverMode === ServerMode.Production ||
    serverMode === ServerMode.Test
  );
}

function addTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : path + "/";
}
