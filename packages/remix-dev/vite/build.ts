import type * as Vite from "vite";
import path from "node:path";
import fse from "fs-extra";
import colors from "picocolors";

import type {
  ResolvedRemixVitePluginConfig,
  ServerBuildConfig,
} from "./plugin";
import type { ConfigRoute, RouteManifest } from "../config/routes";
import invariant from "../invariant";
import { importViteEsmSync } from "./import-vite-esm-sync";

async function extractConfig({
  configFile,
  mode,
  root,
}: {
  configFile?: string;
  mode?: string;
  root: string;
}) {
  let vite = await import("vite");

  // Leverage the Vite config as a way to configure the entire multi-step build
  // process so we don't need to have a separate Remix config
  let viteConfig = await vite.resolveConfig(
    { mode, configFile, root },
    "build"
  );

  let pluginConfig = viteConfig[
    "__remixPluginResolvedConfig" as keyof typeof viteConfig
  ] as ResolvedRemixVitePluginConfig | undefined;
  if (!pluginConfig) {
    console.error(colors.red("Remix Vite plugin not found in Vite config"));
    process.exit(1);
  }

  return { pluginConfig, viteConfig };
}

function getAddressableRoutes(routes: RouteManifest): ConfigRoute[] {
  let nonAddressableIds = new Set<string>();

  for (let id in routes) {
    let route = routes[id];

    // We omit the parent route of index routes since the index route takes ownership of its parent's path
    if (route.index) {
      invariant(
        route.parentId,
        `Expected index route "${route.id}" to have "parentId" set`
      );
      nonAddressableIds.add(route.parentId);
    }

    // We omit pathless routes since they can only be addressed via descendant routes
    if (typeof route.path !== "string" && !route.index) {
      nonAddressableIds.add(id);
    }
  }

  return Object.values(routes).filter(
    (route) => !nonAddressableIds.has(route.id)
  );
}

function getRouteBranch(routes: RouteManifest, routeId: string) {
  let branch: ConfigRoute[] = [];
  let currentRouteId: string | undefined = routeId;

  while (currentRouteId) {
    let route: ConfigRoute = routes[currentRouteId];
    invariant(route, `Missing route for ${currentRouteId}`);
    branch.push(route);
    currentRouteId = route.parentId;
  }

  return branch.reverse();
}

export type ServerBundlesManifest = {
  serverBundles: {
    [serverBundleId: string]: {
      id: string;
      file: string;
    };
  };
  routeIdToBundleId: Record<string, string>;
  routes: RouteManifest;
};

async function getServerBundles({
  routes,
  serverBuildDirectory,
  serverBuildFile,
  serverBundles: getServerBundles,
  rootDirectory,
  appDirectory,
}: ResolvedRemixVitePluginConfig): Promise<{
  serverBundles: ServerBuildConfig[];
  serverBundlesManifest?: ServerBundlesManifest;
}> {
  if (!getServerBundles) {
    return { serverBundles: [{ routes, serverBuildDirectory }] };
  }

  let { normalizePath } = importViteEsmSync();

  let resolvedAppDirectory = path.resolve(rootDirectory, appDirectory);
  let rootRelativeRoutes = Object.fromEntries(
    Object.entries(routes).map(([id, route]) => {
      let filePath = path.join(resolvedAppDirectory, route.file);
      let rootRelativeFilePath = normalizePath(
        path.relative(rootDirectory, filePath)
      );
      return [id, { ...route, file: rootRelativeFilePath }];
    })
  );

  let serverBundlesManifest: ServerBundlesManifest = {
    serverBundles: {},
    routeIdToBundleId: {},
    routes: rootRelativeRoutes,
  };

  let serverBundles = new Map<string, ServerBuildConfig>();

  await Promise.all(
    getAddressableRoutes(routes).map(async (route) => {
      let branch = getRouteBranch(routes, route.id);
      let bundleId = await getServerBundles({
        branch: branch.map((route) => ({
          ...route,
          // Ensure absolute paths are passed to the serverBundles function
          file: path.join(resolvedAppDirectory, route.file),
        })),
      });
      serverBundlesManifest.routeIdToBundleId[route.id] = bundleId;

      let serverBundleDirectory = path.join(serverBuildDirectory, bundleId);
      let serverBuildConfig = serverBundles.get(bundleId);
      if (!serverBuildConfig) {
        serverBundlesManifest.serverBundles[bundleId] = {
          id: bundleId,
          file: normalizePath(
            path.join(serverBundleDirectory, serverBuildFile)
          ),
        };
        serverBuildConfig = {
          routes: {},
          serverBuildDirectory: serverBundleDirectory,
        };
        serverBundles.set(bundleId, serverBuildConfig);
      }
      for (let route of branch) {
        serverBuildConfig.routes[route.id] = route;
      }
    })
  );

  return {
    serverBundles: Array.from(serverBundles.values()),
    serverBundlesManifest,
  };
}

async function cleanServerBuildDirectory(
  viteConfig: Vite.ResolvedConfig,
  { rootDirectory, serverBuildDirectory }: ResolvedRemixVitePluginConfig
) {
  let isWithinRoot = () => {
    let relativePath = path.relative(rootDirectory, serverBuildDirectory);
    return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
  };

  if (viteConfig.build.emptyOutDir ?? isWithinRoot()) {
    await fse.remove(serverBuildDirectory);
  }
}

export interface ViteBuildOptions {
  assetsInlineLimit?: number;
  clearScreen?: boolean;
  config?: string;
  emptyOutDir?: boolean;
  force?: boolean;
  logLevel?: Vite.LogLevel;
  minify?: Vite.BuildOptions["minify"];
  mode?: string;
}

export async function build(
  root: string,
  {
    assetsInlineLimit,
    clearScreen,
    config: configFile,
    emptyOutDir,
    force,
    logLevel,
    minify,
    mode,
  }: ViteBuildOptions
) {
  let { pluginConfig, viteConfig } = await extractConfig({
    configFile,
    mode,
    root,
  });

  let vite = await import("vite");

  async function viteBuild(serverBuildConfig?: ServerBuildConfig) {
    let ssr = Boolean(serverBuildConfig);
    await vite.build({
      root,
      mode,
      configFile,
      build: { assetsInlineLimit, emptyOutDir, minify, ssr },
      optimizeDeps: { force },
      clearScreen,
      logLevel,
      ...(serverBuildConfig
        ? { __remixServerBuildConfig: serverBuildConfig }
        : {}),
    });
  }

  // Since we're potentially running multiple Vite server builds with different
  // output directories, we need to clean the root server build directory
  // ourselves rather than relying on Vite to do it, otherwise you can end up
  // with stale server bundle directories in your build output
  await cleanServerBuildDirectory(viteConfig, pluginConfig);

  // Run the Vite client build first
  await viteBuild();

  // Then run Vite SSR builds in parallel
  let { serverBundles, serverBundlesManifest } = await getServerBundles(
    pluginConfig
  );

  await Promise.all(serverBundles.map(viteBuild));

  if (serverBundlesManifest) {
    await fse.writeFile(
      path.join(pluginConfig.serverBuildDirectory, "bundles.json"),
      JSON.stringify(serverBundlesManifest, null, 2),
      "utf-8"
    );
  }
}
