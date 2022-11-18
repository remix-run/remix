import * as path from "path";
import { pathToFileURL } from "url";
import * as fse from "fs-extra";
import getPort from "get-port";

import type { RouteManifest, DefineRoutesFunction } from "./config/routes";
import { defineRoutes } from "./config/routes";
import { defineConventionalRoutes } from "./config/routesConvention";
import { ServerMode, isValidServerMode } from "./config/serverModes";
import { serverBuildVirtualModule } from "./compiler/virtualModules";
import { writeConfigDefaults } from "./compiler/utils/tsconfig/write-config-defaults";

export interface RemixMdxConfig {
  rehypePlugins?: any[];
  remarkPlugins?: any[];
}

export type RemixMdxConfigFunction = (
  filename: string
) => Promise<RemixMdxConfig | undefined> | RemixMdxConfig | undefined;

export type ServerBuildTarget =
  | "node-cjs"
  | "arc"
  | "netlify"
  | "vercel"
  | "cloudflare-pages"
  | "cloudflare-workers"
  | "deno";

export type ServerModuleFormat = "esm" | "cjs";
export type ServerPlatform = "node" | "neutral";

interface FutureConfig {
  v2_meta: boolean;
}

/**
 * The user-provided config in `remix.config.js`.
 */
export interface AppConfig {
  /**
   * The path to the `app` directory, relative to `remix.config.js`. Defaults
   * to `"app"`.
   */
  appDirectory?: string;

  /**
   * The path to a directory Remix can use for caching things in development,
   * relative to `remix.config.js`. Defaults to `".cache"`.
   */
  cacheDirectory?: string;

  /**
   * A function for defining custom routes, in addition to those already defined
   * using the filesystem convention in `app/routes`. Both sets of routes will
   * be merged.
   */
  routes?: (
    defineRoutes: DefineRoutesFunction
  ) => Promise<ReturnType<DefineRoutesFunction>>;

  /**
   * The path to the server build, relative to `remix.config.js`. Defaults to
   * "build".
   *
   * @deprecated Use {@link ServerConfig.serverBuildPath} instead.
   */
  serverBuildDirectory?: string;

  /**
   * The path to the server build file, relative to `remix.config.js`. This file
   * should end in a `.js` extension and should be deployed to your server.
   *
   * If omitted, the default build path will be based on your
   * {@link ServerConfig.serverBuildTarget}.
   */
  serverBuildPath?: string;

  /**
   * The path to the browser build, relative to `remix.config.js`. Defaults to
   * "public/build".
   */
  assetsBuildDirectory?: string;

  /**
   * The path to the browser build, relative to remix.config.js. Defaults to
   * "public/build".
   *
   * @deprecated Use `{@link ServerConfig.assetsBuildDirectory}` instead
   */
  browserBuildDirectory?: string;

  /**
   * The URL prefix of the browser build with a trailing slash. Defaults to
   * `"/build/"`. This is the path the browser will use to find assets.
   */
  publicPath?: string;

  /**
   * The port number to use for the dev server. Defaults to 8002.
   */
  devServerPort?: number;

  /**
   * The delay, in milliseconds, before the dev server broadcasts a reload
   * event. There is no delay by default.
   */
  devServerBroadcastDelay?: number;

  /**
   * Additional MDX remark / rehype plugins.
   */
  mdx?: RemixMdxConfig | RemixMdxConfigFunction;

  /**
   * The output format of the server build. Defaults to "cjs".
   *
   * @deprecated Use {@link ServerConfig.serverBuildTarget} instead.
   */
  serverModuleFormat?: ServerModuleFormat;

  /**
   * The platform the server build is targeting. Defaults to "node".
   *
   * @deprecated Use {@link ServerConfig.serverBuildTarget} instead.
   */
  serverPlatform?: ServerPlatform;

  /**
   * The target of the server build. Defaults to "node-cjs".
   */
  serverBuildTarget?: ServerBuildTarget;

  /**
   * A server entrypoint, relative to the root directory that becomes your
   * server's main module. If specified, Remix will compile this file along with
   * your application into a single file to be deployed to your server. This
   * file can use either a `.js` or `.ts` file extension.
   */
  server?: string;

  /**
   * A list of filenames or a glob patterns to match files in the `app/routes`
   * directory that Remix will ignore. Matching files will not be recognized as
   * routes.
   */
  ignoredRouteFiles?: string[];

  /**
   * A list of patterns that determined if a module is transpiled and included
   * in the server bundle. This can be useful when consuming ESM only packages
   * in a CJS build.
   */
  serverDependenciesToBundle?: Array<string | RegExp>;

  /**
   * A function for defining custom directories to watch while running `remix dev`, in addition to `appDirectory`.
   */
  watchPaths?:
    | string
    | string[]
    | (() => Promise<string | string[]> | string | string[]);

  future?: Partial<FutureConfig>;
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
   * The absolute path to the application source directory.
   */
  appDirectory: string;

  /**
   * The absolute path to the cache directory.
   */
  cacheDirectory: string;

  /**
   * The path to the entry.client file, relative to `config.appDirectory`.
   */
  entryClientFile: string;

  /**
   * The path to the entry.server file, relative to `config.appDirectory`.
   */
  entryServerFile: string;

  /**
   * An object of all available routes, keyed by route id.
   */
  routes: RouteManifest;

  /**
   * The path to the server build file. This file should end in a `.js`. Defaults
   * are based on {@link ServerConfig.serverBuildTarget}.
   */
  serverBuildPath: string;

  /**
   * The absolute path to the assets build directory.
   */
  assetsBuildDirectory: string;

  /**
   * the original relative path to the assets build directory
   */
  relativeAssetsBuildDirectory: string;

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
   * The delay before the dev (asset) server broadcasts a reload event.
   */
  devServerBroadcastDelay: number;

  /**
   * Additional MDX remark / rehype plugins.
   */
  mdx?: RemixMdxConfig | RemixMdxConfigFunction;

  /**
   * The output format of the server build. Defaults to "cjs".
   */
  serverModuleFormat: ServerModuleFormat;

  /**
   * The platform the server build is targeting. Defaults to "node".
   */
  serverPlatform: ServerPlatform;

  /**
   * The target of the server build.
   */
  serverBuildTarget?: ServerBuildTarget;

  /**
   * The default entry module for the server build if a {@see RemixConfig.customServer} is not provided.
   */
  serverBuildTargetEntryModule: string;

  /**
   * A server entrypoint relative to the root directory that becomes your server's main module.
   */
  serverEntryPoint?: string;

  /**
   * A list of patterns that determined if a module is transpiled and included
   * in the server bundle. This can be useful when consuming ESM only packages
   * in a CJS build.
   */
  serverDependenciesToBundle: Array<string | RegExp>;

  /**
   * A list of directories to watch.
   */
  watchPaths: string[];

  /**
   * The path for the tsconfig file, if present on the root directory.
   */
  tsconfigPath: string | undefined;

  future: FutureConfig;
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
  let configFile = findConfig(rootDirectory, "remix.config");

  let appConfig: AppConfig = {};
  if (configFile) {
    let appConfigModule: any;
    try {
      // shout out to next
      // https://github.com/vercel/next.js/blob/b15a976e11bf1dc867c241a4c1734757427d609c/packages/next/server/config.ts#L748-L765
      if (process.env.NODE_ENV === "test") {
        // dynamic import does not currently work inside of vm which
        // jest relies on so we fall back to require for this case
        // https://github.com/nodejs/node/issues/35889
        appConfigModule = require(configFile);
      } else {
        appConfigModule = await import(pathToFileURL(configFile).href);
      }
      appConfig = appConfigModule?.default || appConfigModule;
    } catch (error) {
      throw new Error(
        `Error loading Remix config at ${configFile}\n${String(error)}`
      );
    }
  }

  let customServerEntryPoint = appConfig.server;
  let serverBuildTarget: ServerBuildTarget | undefined =
    appConfig.serverBuildTarget;
  let serverModuleFormat: ServerModuleFormat =
    appConfig.serverModuleFormat || "cjs";
  let serverPlatform: ServerPlatform = appConfig.serverPlatform || "node";
  switch (appConfig.serverBuildTarget) {
    case "cloudflare-pages":
    case "cloudflare-workers":
    case "deno":
      serverModuleFormat = "esm";
      serverPlatform = "neutral";
      break;
  }

  let mdx = appConfig.mdx;

  let appDirectory = path.resolve(
    rootDirectory,
    appConfig.appDirectory || "app"
  );

  let cacheDirectory = path.resolve(
    rootDirectory,
    appConfig.cacheDirectory || ".cache"
  );

  let entryClientFile = findEntry(appDirectory, "entry.client");
  if (!entryClientFile) {
    throw new Error(`Missing "entry.client" file in ${appDirectory}`);
  }

  let entryServerFile = findEntry(appDirectory, "entry.server");
  if (!entryServerFile) {
    throw new Error(`Missing "entry.server" file in ${appDirectory}`);
  }

  let serverBuildPath = "build/index.js";
  switch (serverBuildTarget) {
    case "arc":
      serverBuildPath = "server/index.js";
      break;
    case "cloudflare-pages":
      serverBuildPath = "functions/[[path]].js";
      break;
    case "netlify":
      serverBuildPath = ".netlify/functions-internal/server.js";
      break;
    case "vercel":
      serverBuildPath = "api/index.js";
      break;
  }
  serverBuildPath = path.resolve(rootDirectory, serverBuildPath);

  // retain deprecated behavior for now
  if (appConfig.serverBuildDirectory) {
    serverBuildPath = path.resolve(
      rootDirectory,
      path.join(appConfig.serverBuildDirectory, "index.js")
    );
  }

  if (appConfig.serverBuildPath) {
    serverBuildPath = path.resolve(rootDirectory, appConfig.serverBuildPath);
  }

  let assetsBuildDirectory =
    appConfig.assetsBuildDirectory ||
    appConfig.browserBuildDirectory ||
    path.join("public", "build");

  let absoluteAssetsBuildDirectory = path.resolve(
    rootDirectory,
    assetsBuildDirectory
  );

  let devServerPort =
    Number(process.env.REMIX_DEV_SERVER_WS_PORT) ||
    (await getPort({ port: Number(appConfig.devServerPort) || 8002 }));
  // set env variable so un-bundled servers can use it
  process.env.REMIX_DEV_SERVER_WS_PORT = `${devServerPort}`;
  let devServerBroadcastDelay = appConfig.devServerBroadcastDelay || 0;

  let defaultPublicPath = "/build/";
  switch (serverBuildTarget) {
    case "arc":
      defaultPublicPath = "/_static/build/";
      break;
  }

  let publicPath = addTrailingSlash(appConfig.publicPath || defaultPublicPath);

  let rootRouteFile = findEntry(appDirectory, "root");
  if (!rootRouteFile) {
    throw new Error(`Missing "root" route file in ${appDirectory}`);
  }

  let routes: RouteManifest = {
    root: { path: "", id: "root", file: rootRouteFile },
  };
  if (fse.existsSync(path.resolve(appDirectory, "routes"))) {
    let conventionalRoutes = defineConventionalRoutes(
      appDirectory,
      appConfig.ignoredRouteFiles
    );
    for (let key of Object.keys(conventionalRoutes)) {
      let route = conventionalRoutes[key];
      routes[route.id] = { ...route, parentId: route.parentId || "root" };
    }
  }
  if (appConfig.routes) {
    let manualRoutes = await appConfig.routes(defineRoutes);
    for (let key of Object.keys(manualRoutes)) {
      let route = manualRoutes[key];
      routes[route.id] = { ...route, parentId: route.parentId || "root" };
    }
  }

  let watchPaths: string[] = [];
  if (typeof appConfig.watchPaths === "function") {
    let directories = await appConfig.watchPaths();
    watchPaths = watchPaths.concat(
      Array.isArray(directories) ? directories : [directories]
    );
  } else if (appConfig.watchPaths) {
    watchPaths = watchPaths.concat(
      Array.isArray(appConfig.watchPaths)
        ? appConfig.watchPaths
        : [appConfig.watchPaths]
    );
  }

  let serverBuildTargetEntryModule = `export * from ${JSON.stringify(
    serverBuildVirtualModule.id
  )};`;

  let serverDependenciesToBundle = appConfig.serverDependenciesToBundle || [];

  // When tsconfigPath is undefined, the default "tsconfig.json" is not
  // found in the root directory.
  let tsconfigPath: string | undefined;
  let rootTsconfig = path.resolve(rootDirectory, "tsconfig.json");
  let rootJsConfig = path.resolve(rootDirectory, "jsconfig.json");

  if (fse.existsSync(rootTsconfig)) {
    tsconfigPath = rootTsconfig;
  } else if (fse.existsSync(rootJsConfig)) {
    tsconfigPath = rootJsConfig;
  }

  if (tsconfigPath) {
    writeConfigDefaults(tsconfigPath);
  }

  let future = {
    v2_meta: appConfig.future?.v2_meta === true,
  };

  return {
    appDirectory,
    cacheDirectory,
    entryClientFile,
    entryServerFile,
    devServerPort,
    devServerBroadcastDelay,
    assetsBuildDirectory: absoluteAssetsBuildDirectory,
    relativeAssetsBuildDirectory: assetsBuildDirectory,
    publicPath,
    rootDirectory,
    routes,
    serverBuildPath,
    serverMode,
    serverModuleFormat,
    serverPlatform,
    serverBuildTarget,
    serverBuildTargetEntryModule,
    serverEntryPoint: customServerEntryPoint,
    serverDependenciesToBundle,
    mdx,
    watchPaths,
    tsconfigPath,
    future,
  };
}

function addTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : path + "/";
}

const entryExts = [".js", ".jsx", ".ts", ".tsx"];

function findEntry(dir: string, basename: string): string | undefined {
  for (let ext of entryExts) {
    let file = path.resolve(dir, basename + ext);
    if (fse.existsSync(file)) return path.relative(dir, file);
  }

  return undefined;
}

const configExts = [".js", ".cjs", ".mjs"];

function findConfig(dir: string, basename: string): string | undefined {
  for (let ext of configExts) {
    let file = path.resolve(dir, basename + ext);
    if (fse.existsSync(file)) return file;
  }

  return undefined;
}
