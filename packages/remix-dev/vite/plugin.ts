// We can only import types from Vite at the top level since we're in a CJS
// context but want to use Vite's ESM build to avoid deprecation warnings
import type * as Vite from "vite";
import { type BinaryLike, createHash } from "node:crypto";
import * as path from "node:path";
import * as url from "node:url";
import * as fse from "fs-extra";
import babel from "@babel/core";
import {
  type ServerBuild,
  unstable_setDevServerHooks as setDevServerHooks,
  createRequestHandler,
} from "@remix-run/server-runtime";
import {
  init as initEsModuleLexer,
  parse as esModuleLexer,
} from "es-module-lexer";
import jsesc from "jsesc";
import pick from "lodash/pick";
import omit from "lodash/omit";
import colors from "picocolors";

import { type RouteManifestEntry, type RouteManifest } from "../config/routes";
import {
  type AppConfig as RemixEsbuildUserConfig,
  type RemixConfig as ResolvedRemixEsbuildConfig,
  resolveConfig as resolveCommonConfig,
  findConfig,
} from "../config";
import { type Manifest as RemixManifest } from "../manifest";
import invariant from "../invariant";
import {
  type NodeRequestHandler,
  fromNodeRequest,
  toNodeRequest,
} from "./node-adapter";
import { getStylesForUrl, isCssModulesFile } from "./styles";
import * as VirtualModule from "./vmod";
import { resolveFileUrl } from "./resolve-file-url";
import { combineURLs } from "./combine-urls";
import { removeExports } from "./remove-exports";
import { importViteEsmSync, preloadViteEsm } from "./import-vite-esm-sync";
import * as ViteNode from "./vite-node";

export async function resolveViteConfig({
  configFile,
  mode,
  root,
}: {
  configFile?: string;
  mode?: string;
  root: string;
}) {
  let vite = await import("vite");

  let viteConfig = await vite.resolveConfig(
    { mode, configFile, root },
    "build", // command
    "production", // default mode
    "production" // default NODE_ENV
  );

  if (typeof viteConfig.build.manifest === "string") {
    throw new Error("Custom Vite manifest paths are not supported");
  }

  return viteConfig;
}

export async function extractRemixPluginContext(
  viteConfig: Vite.ResolvedConfig
) {
  return viteConfig["__remixPluginContext" as keyof typeof viteConfig] as
    | RemixPluginContext
    | undefined;
}

export async function loadVitePluginContext({
  configFile,
  root,
}: {
  configFile?: string;
  root?: string;
}) {
  if (!root) {
    root = process.env.REMIX_ROOT || process.cwd();
  }

  configFile =
    configFile ??
    findConfig(root, "vite.config", [
      ".ts",
      ".cts",
      ".mts",
      ".js",
      ".cjs",
      ".mjs",
    ]);

  // V3 TODO: Vite config should not be optional
  if (!configFile) {
    return;
  }

  let viteConfig = await resolveViteConfig({ configFile, root });
  return await extractRemixPluginContext(viteConfig);
}

const supportedRemixEsbuildConfigKeys = [
  "appDirectory",
  "future",
  "ignoredRouteFiles",
  "routes",
  "serverModuleFormat",
] as const satisfies ReadonlyArray<keyof RemixEsbuildUserConfig>;
type SupportedRemixEsbuildUserConfig = Pick<
  RemixEsbuildUserConfig,
  typeof supportedRemixEsbuildConfigKeys[number]
>;

const SERVER_ONLY_ROUTE_EXPORTS = ["loader", "action", "headers"];
const CLIENT_ROUTE_EXPORTS = [
  "clientAction",
  "clientLoader",
  "default",
  "ErrorBoundary",
  "handle",
  "HydrateFallback",
  "Layout",
  "links",
  "meta",
  "shouldRevalidate",
];

/** This is used to manage a build optimization to remove unused route exports
from the client build output. This is important in cases where custom route
exports are only ever used on the server. Without this optimization we can't
tree-shake any unused custom exports because routes are entry points. */
const BUILD_CLIENT_ROUTE_QUERY_STRING = "?__remix-build-client-route";

// Only expose a subset of route properties to the "serverBundles" function
const branchRouteProperties = [
  "id",
  "path",
  "file",
  "index",
] as const satisfies ReadonlyArray<keyof RouteManifestEntry>;
type BranchRoute = Pick<
  RouteManifestEntry,
  typeof branchRouteProperties[number]
>;

export const configRouteToBranchRoute = (
  configRoute: RouteManifestEntry
): BranchRoute => pick(configRoute, branchRouteProperties);

export type ServerBundlesFunction = (args: {
  branch: BranchRoute[];
}) => string | Promise<string>;

type BaseBuildManifest = {
  routes: RouteManifest;
};

type DefaultBuildManifest = BaseBuildManifest & {
  serverBundles?: never;
  routeIdToServerBundleId?: never;
};

export type ServerBundlesBuildManifest = BaseBuildManifest & {
  serverBundles: {
    [serverBundleId: string]: {
      id: string;
      file: string;
    };
  };
  routeIdToServerBundleId: Record<string, string>;
};

export type BuildManifest = DefaultBuildManifest | ServerBundlesBuildManifest;

const excludedRemixConfigPresetKeys = [
  "presets",
] as const satisfies ReadonlyArray<keyof VitePluginConfig>;

type ExcludedRemixConfigPresetKey =
  typeof excludedRemixConfigPresetKeys[number];

type RemixConfigPreset = Omit<VitePluginConfig, ExcludedRemixConfigPresetKey>;

export type Preset = {
  name: string;
  remixConfig?: (args: {
    remixUserConfig: VitePluginConfig;
  }) => RemixConfigPreset | Promise<RemixConfigPreset>;
  remixConfigResolved?: (args: {
    remixConfig: ResolvedVitePluginConfig;
  }) => void | Promise<void>;
};

export type VitePluginConfig = SupportedRemixEsbuildUserConfig & {
  /**
   * The react router app basename.  Defaults to `"/"`.
   */
  basename?: string;
  /**
   * The path to the build directory, relative to the project. Defaults to
   * `"build"`.
   */
  buildDirectory?: string;
  /**
   * A function that is called after the full Remix build is complete.
   */
  buildEnd?: BuildEndHook;
  /**
   * Whether to write a `"manifest.json"` file to the build directory.`
   * Defaults to `false`.
   */
  manifest?: boolean;
  /**
   * An array of Remix config presets to ease integration with other platforms
   * and tools.
   */
  presets?: Array<Preset>;
  /**
   * The file name of the server build output. This file
   * should end in a `.js` extension and should be deployed to your server.
   * Defaults to `"index.js"`.
   */
  serverBuildFile?: string;
  /**
   * A function for assigning routes to different server bundles. This
   * function should return a server bundle ID which will be used as the
   * bundle's directory name within the server build directory.
   */
  serverBundles?: ServerBundlesFunction;
  /**
   * Enable server-side rendering for your application. Disable to use Remix in
   * "SPA Mode", which will request the `/` path at build-time and save it as
   * an `index.html` file with your assets so your application can be deployed
   * as a SPA without server-rendering. Default's to `true`.
   */
  ssr?: boolean;
};

type BuildEndHook = (args: {
  buildManifest: BuildManifest | undefined;
  remixConfig: ResolvedVitePluginConfig;
  viteConfig: Vite.ResolvedConfig;
}) => void | Promise<void>;

export type ResolvedVitePluginConfig = Readonly<
  Pick<
    ResolvedRemixEsbuildConfig,
    "appDirectory" | "future" | "publicPath" | "routes" | "serverModuleFormat"
  > & {
    basename: string;
    buildDirectory: string;
    buildEnd?: BuildEndHook;
    manifest: boolean;
    publicPath: string; // derived from Vite's `base` config
    serverBuildFile: string;
    serverBundles?: ServerBundlesFunction;
    ssr: boolean;
  }
>;

export type ServerBundleBuildConfig = {
  routes: RouteManifest;
  serverBundleId: string;
};

type RemixPluginSsrBuildContext =
  | {
      isSsrBuild: false;
      getRemixServerManifest?: never;
      serverBundleBuildConfig?: never;
    }
  | {
      isSsrBuild: true;
      getRemixServerManifest: () => Promise<RemixManifest>;
      serverBundleBuildConfig: ServerBundleBuildConfig | null;
    };

export type RemixPluginContext = RemixPluginSsrBuildContext & {
  rootDirectory: string;
  entryClientFilePath: string;
  entryServerFilePath: string;
  remixConfig: ResolvedVitePluginConfig;
  viteManifestEnabled: boolean;
};

let serverBuildId = VirtualModule.id("server-build");
let serverManifestId = VirtualModule.id("server-manifest");
let browserManifestId = VirtualModule.id("browser-manifest");
let hmrRuntimeId = VirtualModule.id("hmr-runtime");
let injectHmrRuntimeId = VirtualModule.id("inject-hmr-runtime");

const resolveRelativeRouteFilePath = (
  route: RouteManifestEntry,
  remixConfig: ResolvedVitePluginConfig
) => {
  let vite = importViteEsmSync();
  let file = route.file;
  let fullPath = path.resolve(remixConfig.appDirectory, file);

  return vite.normalizePath(fullPath);
};

let vmods = [serverBuildId, serverManifestId, browserManifestId];

const invalidateVirtualModules = (viteDevServer: Vite.ViteDevServer) => {
  vmods.forEach((vmod) => {
    let mod = viteDevServer.moduleGraph.getModuleById(
      VirtualModule.resolve(vmod)
    );
    if (mod) {
      viteDevServer.moduleGraph.invalidateModule(mod);
    }
  });
};

const getHash = (source: BinaryLike, maxLength?: number): string => {
  let hash = createHash("sha256").update(source).digest("hex");
  return typeof maxLength === "number" ? hash.slice(0, maxLength) : hash;
};

const resolveChunk = (
  ctx: RemixPluginContext,
  viteManifest: Vite.Manifest,
  absoluteFilePath: string
) => {
  let vite = importViteEsmSync();
  let rootRelativeFilePath = vite.normalizePath(
    path.relative(ctx.rootDirectory, absoluteFilePath)
  );
  let entryChunk =
    viteManifest[rootRelativeFilePath + BUILD_CLIENT_ROUTE_QUERY_STRING] ??
    viteManifest[rootRelativeFilePath];

  if (!entryChunk) {
    let knownManifestKeys = Object.keys(viteManifest)
      .map((key) => '"' + key + '"')
      .join(", ");
    throw new Error(
      `No manifest entry found for "${rootRelativeFilePath}". Known manifest keys: ${knownManifestKeys}`
    );
  }

  return entryChunk;
};

const getRemixManifestBuildAssets = (
  ctx: RemixPluginContext,
  viteManifest: Vite.Manifest,
  entryFilePath: string,
  prependedAssetFilePaths: string[] = []
): RemixManifest["entry"] & { css: string[] } => {
  let entryChunk = resolveChunk(ctx, viteManifest, entryFilePath);

  // This is here to support prepending client entry assets to the root route
  let prependedAssetChunks = prependedAssetFilePaths.map((filePath) =>
    resolveChunk(ctx, viteManifest, filePath)
  );

  let chunks = resolveDependantChunks(viteManifest, [
    ...prependedAssetChunks,
    entryChunk,
  ]);

  return {
    module: `${ctx.remixConfig.publicPath}${entryChunk.file}`,
    imports:
      dedupe(chunks.flatMap((e) => e.imports ?? [])).map((imported) => {
        return `${ctx.remixConfig.publicPath}${viteManifest[imported].file}`;
      }) ?? [],
    css:
      dedupe(chunks.flatMap((e) => e.css ?? [])).map((href) => {
        return `${ctx.remixConfig.publicPath}${href}`;
      }) ?? [],
  };
};

function resolveDependantChunks(
  viteManifest: Vite.Manifest,
  entryChunks: Vite.ManifestChunk[]
): Vite.ManifestChunk[] {
  let chunks = new Set<Vite.ManifestChunk>();

  function walk(chunk: Vite.ManifestChunk) {
    if (chunks.has(chunk)) {
      return;
    }

    chunks.add(chunk);

    if (chunk.imports) {
      for (let importKey of chunk.imports) {
        walk(viteManifest[importKey]);
      }
    }
  }

  for (let entryChunk of entryChunks) {
    walk(entryChunk);
  }

  return Array.from(chunks);
}

function dedupe<T>(array: T[]): T[] {
  return [...new Set(array)];
}

const writeFileSafe = async (file: string, contents: string): Promise<void> => {
  await fse.ensureDir(path.dirname(file));
  await fse.writeFile(file, contents);
};

const getRouteManifestModuleExports = async (
  viteChildCompiler: Vite.ViteDevServer | null,
  ctx: RemixPluginContext
): Promise<Record<string, string[]>> => {
  let entries = await Promise.all(
    Object.entries(ctx.remixConfig.routes).map(async ([key, route]) => {
      let sourceExports = await getRouteModuleExports(
        viteChildCompiler,
        ctx,
        route.file
      );
      return [key, sourceExports] as const;
    })
  );
  return Object.fromEntries(entries);
};

const getRouteModuleExports = async (
  viteChildCompiler: Vite.ViteDevServer | null,
  ctx: RemixPluginContext,
  routeFile: string,
  readRouteFile?: () => string | Promise<string>
): Promise<string[]> => {
  if (!viteChildCompiler) {
    throw new Error("Vite child compiler not found");
  }

  // We transform the route module code with the Vite child compiler so that we
  // can parse the exports from non-JS files like MDX. This ensures that we can
  // understand the exports from anything that Vite can compile to JS, not just
  // the route file formats that the Remix compiler historically supported.

  let ssr = true;
  let { pluginContainer, moduleGraph } = viteChildCompiler;

  let routePath = path.resolve(ctx.remixConfig.appDirectory, routeFile);
  let url = resolveFileUrl(ctx, routePath);

  let resolveId = async () => {
    let result = await pluginContainer.resolveId(url, undefined, { ssr });
    if (!result) throw new Error(`Could not resolve module ID for ${url}`);
    return result.id;
  };

  let [id, code] = await Promise.all([
    resolveId(),
    readRouteFile?.() ?? fse.readFile(routePath, "utf-8"),
    // pluginContainer.transform(...) fails if we don't do this first:
    moduleGraph.ensureEntryFromUrl(url, ssr),
  ]);

  let transformed = await pluginContainer.transform(code, id, { ssr });
  let [, exports] = esModuleLexer(transformed.code);
  let exportNames = exports.map((e) => e.n);

  return exportNames;
};

const getServerBundleBuildConfig = (
  viteUserConfig: Vite.UserConfig
): ServerBundleBuildConfig | null => {
  if (
    !("__remixServerBundleBuildConfig" in viteUserConfig) ||
    !viteUserConfig.__remixServerBundleBuildConfig
  ) {
    return null;
  }

  return viteUserConfig.__remixServerBundleBuildConfig as ServerBundleBuildConfig;
};

export let getServerBuildDirectory = (ctx: RemixPluginContext) =>
  path.join(
    ctx.remixConfig.buildDirectory,
    "server",
    ...(ctx.serverBundleBuildConfig
      ? [ctx.serverBundleBuildConfig.serverBundleId]
      : [])
  );

let getClientBuildDirectory = (remixConfig: ResolvedVitePluginConfig) =>
  path.join(remixConfig.buildDirectory, "client");

let defaultEntriesDir = path.resolve(__dirname, "..", "config", "defaults");
let defaultEntries = fse
  .readdirSync(defaultEntriesDir)
  .map((filename) => path.join(defaultEntriesDir, filename));
invariant(defaultEntries.length > 0, "No default entries found");

let mergeRemixConfig = (...configs: VitePluginConfig[]): VitePluginConfig => {
  let reducer = (
    configA: VitePluginConfig,
    configB: VitePluginConfig
  ): VitePluginConfig => {
    let mergeRequired = (key: keyof VitePluginConfig) =>
      configA[key] !== undefined && configB[key] !== undefined;

    return {
      ...configA,
      ...configB,
      ...(mergeRequired("buildEnd")
        ? {
            buildEnd: async (...args) => {
              await Promise.all([
                configA.buildEnd?.(...args),
                configB.buildEnd?.(...args),
              ]);
            },
          }
        : {}),
      ...(mergeRequired("future")
        ? {
            future: {
              ...configA.future,
              ...configB.future,
            },
          }
        : {}),
      ...(mergeRequired("ignoredRouteFiles")
        ? {
            ignoredRouteFiles: Array.from(
              new Set([
                ...(configA.ignoredRouteFiles ?? []),
                ...(configB.ignoredRouteFiles ?? []),
              ])
            ),
          }
        : {}),
      ...(mergeRequired("presets")
        ? {
            presets: [...(configA.presets ?? []), ...(configB.presets ?? [])],
          }
        : {}),
      ...(mergeRequired("routes")
        ? {
            routes: async (...args) => {
              let [routesA, routesB] = await Promise.all([
                configA.routes?.(...args),
                configB.routes?.(...args),
              ]);

              return {
                ...routesA,
                ...routesB,
              };
            },
          }
        : {}),
    };
  };

  return configs.reduce(reducer, {});
};

type MaybePromise<T> = T | Promise<T>;

let remixDevLoadContext: (
  request: Request
) => MaybePromise<Record<string, unknown>> = () => ({});

export let setRemixDevLoadContext = (
  loadContext: (request: Request) => MaybePromise<Record<string, unknown>>
) => {
  remixDevLoadContext = loadContext;
};

// Inlined from https://github.com/jsdf/deep-freeze
let deepFreeze = (o: any) => {
  Object.freeze(o);
  let oIsFunction = typeof o === "function";
  let hasOwnProp = Object.prototype.hasOwnProperty;
  Object.getOwnPropertyNames(o).forEach(function (prop) {
    if (
      hasOwnProp.call(o, prop) &&
      (oIsFunction
        ? prop !== "caller" && prop !== "callee" && prop !== "arguments"
        : true) &&
      o[prop] !== null &&
      (typeof o[prop] === "object" || typeof o[prop] === "function") &&
      !Object.isFrozen(o[prop])
    ) {
      deepFreeze(o[prop]);
    }
  });
  return o;
};

export type RemixVitePlugin = (config?: VitePluginConfig) => Vite.Plugin[];
export const remixVitePlugin: RemixVitePlugin = (remixUserConfig = {}) => {
  // Prevent mutations to the user config
  remixUserConfig = deepFreeze(remixUserConfig);

  let viteCommand: Vite.ResolvedConfig["command"];
  let viteUserConfig: Vite.UserConfig;
  let viteConfigEnv: Vite.ConfigEnv;
  let viteConfig: Vite.ResolvedConfig | undefined;
  let cssModulesManifest: Record<string, string> = {};
  let viteChildCompiler: Vite.ViteDevServer | null = null;
  let routesViteNodeContext: ViteNode.Context | null = null;

  let ssrExternals = isInRemixMonorepo()
    ? [
        // This is only needed within the Remix repo because these
        // packages are linked to a directory outside of node_modules
        // so Vite treats them as internal code by default.
        "@remix-run/architect",
        "@remix-run/cloudflare-pages",
        "@remix-run/cloudflare-workers",
        "@remix-run/cloudflare",
        "@remix-run/css-bundle",
        "@remix-run/deno",
        "@remix-run/dev",
        "@remix-run/express",
        "@remix-run/netlify",
        "@remix-run/node",
        "@remix-run/react",
        "@remix-run/serve",
        "@remix-run/server-runtime",
      ]
    : undefined;

  // This is initialized by `updateRemixPluginContext` during Vite's `config`
  // hook, so most of the code can assume this defined without null check.
  // During dev, `updateRemixPluginContext` is called again on every config file
  // change or route file addition/removal.
  let ctx: RemixPluginContext;

  /** Mutates `ctx` as a side-effect */
  let updateRemixPluginContext = async ({
    routeConfigChanged = false,
  }: {
    routeConfigChanged?: boolean;
  } = {}): Promise<void> => {
    let remixConfigPresets: VitePluginConfig[] = (
      await Promise.all(
        (remixUserConfig.presets ?? []).map(async (preset) => {
          if (!preset.name) {
            throw new Error(
              "Remix presets must have a `name` property defined."
            );
          }

          if (!preset.remixConfig) {
            return null;
          }

          let remixConfigPreset: VitePluginConfig = omit(
            await preset.remixConfig({ remixUserConfig }),
            excludedRemixConfigPresetKeys
          );

          return remixConfigPreset;
        })
      )
    ).filter(function isNotNull<T>(value: T | null): value is T {
      return value !== null;
    });

    let defaults = {
      basename: "/",
      buildDirectory: "build",
      manifest: false,
      serverBuildFile: "index.js",
      ssr: true,
    } as const satisfies Partial<VitePluginConfig>;

    let resolvedRemixUserConfig = {
      ...defaults, // Default values should be completely overridden by user/preset config, not merged
      ...mergeRemixConfig(...remixConfigPresets, remixUserConfig),
    };

    let rootDirectory =
      viteUserConfig.root ?? process.env.REMIX_ROOT ?? process.cwd();

    let { basename, buildEnd, manifest, ssr } = resolvedRemixUserConfig;
    let isSpaMode = !ssr;

    // Only select the Remix esbuild config options that the Vite plugin uses
    invariant(routesViteNodeContext);
    let {
      appDirectory,
      entryClientFilePath,
      entryServerFilePath,
      future,
      routes,
      serverModuleFormat,
    } = await resolveCommonConfig(
      pick(resolvedRemixUserConfig, supportedRemixEsbuildConfigKeys),
      {
        rootDirectory,
        isSpaMode,
        vite: importViteEsmSync(),
        routeConfigChanged,
        viteUserConfig,
        routesViteNodeContext,
      }
    );

    let buildDirectory = path.resolve(
      rootDirectory,
      resolvedRemixUserConfig.buildDirectory
    );

    let { serverBuildFile, serverBundles } = resolvedRemixUserConfig;

    let publicPath = viteUserConfig.base ?? "/";

    if (
      basename !== "/" &&
      viteCommand === "serve" &&
      !viteUserConfig.server?.middlewareMode &&
      !basename.startsWith(publicPath)
    ) {
      throw new Error(
        "When using the Remix `basename` and the Vite `base` config, " +
          "the `basename` config must begin with `base` for the default " +
          "Vite dev server."
      );
    }

    // Log warning for incompatible vite config flags
    if (isSpaMode && serverBundles) {
      console.warn(
        colors.yellow(
          colors.bold("⚠️  SPA Mode: ") +
            "the `serverBundles` config is invalid with " +
            "`ssr:false` and will be ignored`"
        )
      );
      serverBundles = undefined;
    }

    let remixConfig: ResolvedVitePluginConfig = deepFreeze({
      appDirectory,
      basename,
      buildDirectory,
      buildEnd,
      future,
      manifest,
      publicPath,
      routes,
      serverBuildFile,
      serverBundles,
      serverModuleFormat,
      ssr,
    });

    for (let preset of remixUserConfig.presets ?? []) {
      await preset.remixConfigResolved?.({ remixConfig });
    }

    let viteManifestEnabled = viteUserConfig.build?.manifest === true;

    let ssrBuildCtx: RemixPluginSsrBuildContext =
      viteConfigEnv.isSsrBuild && viteCommand === "build"
        ? {
            isSsrBuild: true,
            getRemixServerManifest: async () =>
              (await generateRemixManifestsForBuild()).remixServerManifest,
            serverBundleBuildConfig: getServerBundleBuildConfig(viteUserConfig),
          }
        : { isSsrBuild: false };

    ctx = {
      remixConfig,
      rootDirectory,
      entryClientFilePath,
      entryServerFilePath,
      viteManifestEnabled,
      ...ssrBuildCtx,
    };
  };

  let pluginIndex = (pluginName: string) => {
    invariant(viteConfig);
    return viteConfig.plugins.findIndex((plugin) => plugin.name === pluginName);
  };

  let getServerEntry = async () => {
    invariant(viteConfig, "viteconfig required to generate the server entry");

    // v3 TODO:
    // - Deprecate `ServerBuild.mode` once we officially stabilize vite and
    //   mark the old compiler as deprecated
    // - Remove `ServerBuild.mode` in v3

    let routes = ctx.serverBundleBuildConfig
      ? // For server bundle builds, the server build should only import the
        // routes for this bundle rather than importing all routes
        ctx.serverBundleBuildConfig.routes
      : // Otherwise, all routes are imported as usual
        ctx.remixConfig.routes;

    return `
    import * as entryServer from ${JSON.stringify(
      resolveFileUrl(ctx, ctx.entryServerFilePath)
    )};
    ${Object.keys(routes)
      .map((key, index) => {
        let route = routes[key]!;
        return `import * as route${index} from ${JSON.stringify(
          resolveFileUrl(
            ctx,
            resolveRelativeRouteFilePath(route, ctx.remixConfig)
          )
        )};`;
      })
      .join("\n")}
      /**
       * \`mode\` is only relevant for the old Remix compiler but
       * is included here to satisfy the \`ServerBuild\` typings.
       */
      export const mode = ${JSON.stringify(viteConfig.mode)};
      export { default as assets } from ${JSON.stringify(serverManifestId)};
      export const assetsBuildDirectory = ${JSON.stringify(
        path.relative(
          ctx.rootDirectory,
          getClientBuildDirectory(ctx.remixConfig)
        )
      )};
      export const basename = ${JSON.stringify(ctx.remixConfig.basename)};
      export const future = ${JSON.stringify(ctx.remixConfig.future)};
      export const isSpaMode = ${!ctx.remixConfig.ssr};
      export const publicPath = ${JSON.stringify(ctx.remixConfig.publicPath)};
      export const entry = { module: entryServer };
      export const routes = {
        ${Object.keys(routes)
          .map((key, index) => {
            let route = routes[key]!;
            return `${JSON.stringify(key)}: {
          id: ${JSON.stringify(route.id)},
          parentId: ${JSON.stringify(route.parentId)},
          path: ${JSON.stringify(route.path)},
          index: ${JSON.stringify(route.index)},
          caseSensitive: ${JSON.stringify(route.caseSensitive)},
          module: route${index}
        }`;
          })
          .join(",\n  ")}
      };`;
  };

  let loadViteManifest = async (directory: string) => {
    let manifestContents = await fse.readFile(
      path.resolve(directory, ".vite", "manifest.json"),
      "utf-8"
    );
    return JSON.parse(manifestContents) as Vite.Manifest;
  };

  let getViteManifestAssetPaths = (
    viteManifest: Vite.Manifest
  ): Set<string> => {
    // Get .css?url imports and CSS entry points
    let cssUrlPaths = Object.values(viteManifest)
      .filter((chunk) => chunk.file.endsWith(".css"))
      .map((chunk) => chunk.file);

    // Get bundled CSS files and generic asset types
    let chunkAssetPaths = Object.values(viteManifest).flatMap(
      (chunk) => chunk.assets ?? []
    );

    return new Set([...cssUrlPaths, ...chunkAssetPaths]);
  };

  let generateRemixManifestsForBuild = async (): Promise<{
    remixBrowserManifest: RemixManifest;
    remixServerManifest: RemixManifest;
  }> => {
    invariant(viteConfig);

    let viteManifest = await loadViteManifest(
      getClientBuildDirectory(ctx.remixConfig)
    );

    let entry = getRemixManifestBuildAssets(
      ctx,
      viteManifest,
      ctx.entryClientFilePath
    );

    let browserRoutes: RemixManifest["routes"] = {};
    let serverRoutes: RemixManifest["routes"] = {};

    let routeManifestExports = await getRouteManifestModuleExports(
      viteChildCompiler,
      ctx
    );

    for (let [key, route] of Object.entries(ctx.remixConfig.routes)) {
      let routeFilePath = path.join(ctx.remixConfig.appDirectory, route.file);
      let sourceExports = routeManifestExports[key];
      let isRootRoute = route.parentId === undefined;

      let routeManifestEntry = {
        id: route.id,
        parentId: route.parentId,
        path: route.path,
        index: route.index,
        caseSensitive: route.caseSensitive,
        hasAction: sourceExports.includes("action"),
        hasLoader: sourceExports.includes("loader"),
        hasClientAction: sourceExports.includes("clientAction"),
        hasClientLoader: sourceExports.includes("clientLoader"),
        hasErrorBoundary: sourceExports.includes("ErrorBoundary"),
        ...getRemixManifestBuildAssets(
          ctx,
          viteManifest,
          routeFilePath,
          // If this is the root route, we also need to include assets from the
          // client entry file as this is a common way for consumers to import
          // global reset styles, etc.
          isRootRoute ? [ctx.entryClientFilePath] : []
        ),
      };

      browserRoutes[key] = routeManifestEntry;

      let serverBundleRoutes = ctx.serverBundleBuildConfig?.routes;
      if (!serverBundleRoutes || serverBundleRoutes[key]) {
        serverRoutes[key] = routeManifestEntry;
      }
    }

    let fingerprintedValues = { entry, routes: browserRoutes };
    let version = getHash(JSON.stringify(fingerprintedValues), 8);
    let manifestPath = path.posix.join(
      viteConfig.build.assetsDir,
      `manifest-${version}.js`
    );
    let url = `${ctx.remixConfig.publicPath}${manifestPath}`;
    let nonFingerprintedValues = { url, version };

    let remixBrowserManifest: RemixManifest = {
      ...fingerprintedValues,
      ...nonFingerprintedValues,
    };

    // Write the browser manifest to disk as part of the build process
    await writeFileSafe(
      path.join(getClientBuildDirectory(ctx.remixConfig), manifestPath),
      `window.__remixManifest=${JSON.stringify(remixBrowserManifest)};`
    );

    // The server manifest is the same as the browser manifest, except for
    // server bundle builds which only includes routes for the current bundle,
    // otherwise the server and client have the same routes
    let remixServerManifest: RemixManifest = {
      ...remixBrowserManifest,
      routes: serverRoutes,
    };

    return {
      remixBrowserManifest,
      remixServerManifest,
    };
  };

  // In dev, the server and browser Remix manifests are the same
  let getRemixManifestForDev = async (): Promise<RemixManifest> => {
    let routes: RemixManifest["routes"] = {};

    let routeManifestExports = await getRouteManifestModuleExports(
      viteChildCompiler,
      ctx
    );

    for (let [key, route] of Object.entries(ctx.remixConfig.routes)) {
      let sourceExports = routeManifestExports[key];
      routes[key] = {
        id: route.id,
        parentId: route.parentId,
        path: route.path,
        index: route.index,
        caseSensitive: route.caseSensitive,
        module: combineURLs(
          ctx.remixConfig.publicPath,
          `${resolveFileUrl(
            ctx,
            resolveRelativeRouteFilePath(route, ctx.remixConfig)
          )}`
        ),
        hasAction: sourceExports.includes("action"),
        hasLoader: sourceExports.includes("loader"),
        hasClientAction: sourceExports.includes("clientAction"),
        hasClientLoader: sourceExports.includes("clientLoader"),
        hasErrorBoundary: sourceExports.includes("ErrorBoundary"),
        imports: [],
      };
    }

    return {
      version: String(Math.random()),
      url: combineURLs(
        ctx.remixConfig.publicPath,
        VirtualModule.url(browserManifestId)
      ),
      hmr: {
        runtime: combineURLs(
          ctx.remixConfig.publicPath,
          VirtualModule.url(injectHmrRuntimeId)
        ),
      },
      entry: {
        module: combineURLs(
          ctx.remixConfig.publicPath,
          resolveFileUrl(ctx, ctx.entryClientFilePath)
        ),
        imports: [],
      },
      routes,
    };
  };

  return [
    {
      name: "remix",
      config: async (_viteUserConfig, _viteConfigEnv) => {
        // Preload Vite's ESM build up-front as soon as we're in an async context
        await preloadViteEsm();

        // Ensure sync import of Vite works after async preload
        let vite = importViteEsmSync();

        viteUserConfig = _viteUserConfig;
        viteConfigEnv = _viteConfigEnv;
        viteCommand = viteConfigEnv.command;

        routesViteNodeContext = await ViteNode.createContext({
          root: viteUserConfig.root,
          mode: viteConfigEnv.mode,
          server: {
            watch: viteCommand === "build" ? null : undefined,
          },
          ssr: {
            external: ssrExternals,
          },
        });

        await updateRemixPluginContext();

        Object.assign(
          process.env,
          vite.loadEnv(
            viteConfigEnv.mode,
            ctx.rootDirectory,
            // We override default prefix of "VITE_" with a blank string since
            // we're targeting the server, so we want to load all environment
            // variables, not just those explicitly marked for the client
            ""
          )
        );

        let baseRollupOptions = {
          // Silence Rollup "use client" warnings
          // Adapted from https://github.com/vitejs/vite-plugin-react/pull/144
          onwarn(warning, defaultHandler) {
            if (
              warning.code === "MODULE_LEVEL_DIRECTIVE" &&
              warning.message.includes("use client")
            ) {
              return;
            }
            if (viteUserConfig.build?.rollupOptions?.onwarn) {
              viteUserConfig.build.rollupOptions.onwarn(
                warning,
                defaultHandler
              );
            } else {
              defaultHandler(warning);
            }
          },
        } satisfies Vite.BuildOptions["rollupOptions"];

        return {
          __remixPluginContext: ctx,
          appType:
            viteCommand === "serve" &&
            viteConfigEnv.mode === "production" &&
            ctx.remixConfig.ssr === false
              ? "spa"
              : "custom",

          ssr: {
            external: ssrExternals,
          },
          optimizeDeps: {
            entries: ctx.remixConfig.future.unstable_optimizeDeps
              ? [
                  importViteEsmSync().normalizePath(ctx.entryClientFilePath),
                  ...Object.values(ctx.remixConfig.routes).map((route) =>
                    resolveRelativeRouteFilePath(route, ctx.remixConfig)
                  ),
                ]
              : [],
            include: [
              // Pre-bundle React dependencies to avoid React duplicates,
              // even if React dependencies are not direct dependencies.
              // https://react.dev/warnings/invalid-hook-call-warning#duplicate-react
              "react",
              "react/jsx-runtime",
              "react/jsx-dev-runtime",
              "react-dom/client",

              // Pre-bundle Remix dependencies to avoid Remix router duplicates.
              // Our remix-remix-react-proxy plugin does not process default client and
              // server entry files since those come from within `node_modules`.
              // That means that before Vite pre-bundles dependencies (e.g. first time dev server is run)
              // mismatching Remix routers cause `Error: You must render this element inside a <Remix> element`.
              "@remix-run/react",
            ],
          },
          esbuild: {
            jsx: "automatic",
            jsxDev: viteCommand !== "build",
          },
          resolve: {
            dedupe: [
              // https://react.dev/warnings/invalid-hook-call-warning#duplicate-react
              "react",
              "react-dom",

              // see description for `@remix-run/react` in `optimizeDeps.include`
              "@remix-run/react",
            ],
          },
          base: viteUserConfig.base,

          // When consumer provides an allow list for files that can be read by
          // the server, ensure that Remix's default entry files are included.
          // If we don't do this and a default entry file is used, the server
          // will throw an error that the file is not allowed to be read.
          // https://vitejs.dev/config/server-options#server-fs-allow
          server: viteUserConfig.server?.fs?.allow
            ? { fs: { allow: defaultEntries } }
            : undefined,

          // Vite config options for building
          ...(viteCommand === "build"
            ? {
                build: {
                  cssMinify: viteUserConfig.build?.cssMinify ?? true,
                  ...(!viteConfigEnv.isSsrBuild
                    ? {
                        manifest: true,
                        outDir: getClientBuildDirectory(ctx.remixConfig),
                        rollupOptions: {
                          ...baseRollupOptions,
                          preserveEntrySignatures: "exports-only",
                          input: [
                            ctx.entryClientFilePath,
                            ...Object.values(ctx.remixConfig.routes).map(
                              (route) =>
                                `${path.resolve(
                                  ctx.remixConfig.appDirectory,
                                  route.file
                                )}${BUILD_CLIENT_ROUTE_QUERY_STRING}`
                            ),
                          ],
                        },
                      }
                    : {
                        // We move SSR-only assets to client assets. Note that the
                        // SSR build can also emit code-split JS files (e.g. by
                        // dynamic import) under the same assets directory
                        // regardless of "ssrEmitAssets" option, so we also need to
                        // keep these JS files have to be kept as-is.
                        ssrEmitAssets: true,
                        copyPublicDir: false, // Assets in the public directory are only used by the client
                        manifest: true, // We need the manifest to detect SSR-only assets
                        outDir: getServerBuildDirectory(ctx),
                        rollupOptions: {
                          ...baseRollupOptions,
                          preserveEntrySignatures: "exports-only",
                          input: serverBuildId,
                          output: {
                            entryFileNames: ctx.remixConfig.serverBuildFile,
                            format: ctx.remixConfig.serverModuleFormat,
                          },
                        },
                      }),
                },
              }
            : undefined),

          // Vite config options for SPA preview mode
          ...(viteCommand === "serve" && ctx.remixConfig.ssr === false
            ? {
                build: {
                  manifest: true,
                  outDir: getClientBuildDirectory(ctx.remixConfig),
                },
              }
            : undefined),
        };
      },
      async configResolved(resolvedViteConfig) {
        await initEsModuleLexer;

        viteConfig = resolvedViteConfig;
        invariant(viteConfig);

        // We load the same Vite config file again for the child compiler so
        // that both parent and child compiler's plugins have independent state.
        // If we re-used the `viteUserConfig.plugins` array for the child
        // compiler, it could lead to mutating shared state between plugin
        // instances in unexpected ways, e.g. during `vite build` the
        // `configResolved` plugin hook would be called with `command = "build"`
        // by parent and then `command = "serve"` by child, which some plugins
        // may respond to by updating state referenced by the parent.
        if (!viteConfig.configFile) {
          throw new Error(
            "The Remix Vite plugin requires the use of a Vite config file"
          );
        }

        let vite = importViteEsmSync();

        let childCompilerConfigFile = await vite.loadConfigFromFile(
          {
            command: viteConfig.command,
            mode: viteConfig.mode,
            isSsrBuild: ctx.isSsrBuild,
          },
          viteConfig.configFile
        );

        invariant(
          childCompilerConfigFile,
          "Vite config file was unable to be resolved for Remix child compiler"
        );

        // Validate that commonly used Rollup plugins that need to run before
        // Remix are in the correct order. This is because Rollup plugins can't
        // set `enforce: "pre"` like Vite plugins can. Explicitly validating
        // this provides a much nicer developer experience.
        let rollupPrePlugins = [
          { pluginName: "@mdx-js/rollup", displayName: "@mdx-js/rollup" },
        ];
        for (let prePlugin of rollupPrePlugins) {
          let prePluginIndex = pluginIndex(prePlugin.pluginName);
          if (prePluginIndex >= 0 && prePluginIndex > pluginIndex("remix")) {
            throw new Error(
              `The "${prePlugin.displayName}" plugin should be placed before the Remix plugin in your Vite config file`
            );
          }
        }

        viteChildCompiler = await vite.createServer({
          ...viteUserConfig,
          mode: viteConfig.mode,
          server: {
            watch: viteConfig.command === "build" ? null : undefined,
            preTransformRequests: false,
            hmr: false,
          },
          configFile: false,
          envFile: false,
          plugins: [
            ...(childCompilerConfigFile.config.plugins ?? [])
              .flat()
              // Exclude this plugin from the child compiler to prevent an
              // infinite loop (plugin creates a child compiler with the same
              // plugin that creates another child compiler, repeat ad
              // infinitum), and to prevent the manifest from being written to
              // disk from the child compiler. This is important in the
              // production build because the child compiler is a Vite dev
              // server and will generate incorrect manifests.
              .filter(
                (plugin) =>
                  typeof plugin === "object" &&
                  plugin !== null &&
                  "name" in plugin &&
                  plugin.name !== "remix" &&
                  plugin.name !== "remix-hmr-updates"
              ),
          ],
        });
        await viteChildCompiler.pluginContainer.buildStart({});
      },
      async transform(code, id) {
        if (isCssModulesFile(id)) {
          cssModulesManifest[id] = code;
        }

        if (id.endsWith(BUILD_CLIENT_ROUTE_QUERY_STRING)) {
          let routeModuleId = id.replace(BUILD_CLIENT_ROUTE_QUERY_STRING, "");
          let sourceExports = await getRouteModuleExports(
            viteChildCompiler,
            ctx,
            routeModuleId
          );

          let routeFileName = path.basename(routeModuleId);
          let clientExports = sourceExports
            .filter((exportName) => CLIENT_ROUTE_EXPORTS.includes(exportName))
            .join(", ");

          return `export { ${clientExports} } from "./${routeFileName}";`;
        }
      },
      buildStart() {
        invariant(viteConfig);

        if (
          viteCommand === "build" &&
          viteConfig.mode === "production" &&
          !viteConfig.build.ssr &&
          viteConfig.build.sourcemap
        ) {
          viteConfig.logger.warn(
            colors.yellow(
              "\n" +
                colors.bold("  ⚠️  Source maps are enabled in production\n") +
                [
                  "This makes your server code publicly",
                  "visible in the browser. This is highly",
                  "discouraged! If you insist, ensure that",
                  "you are using environment variables for",
                  "secrets and not hard-coding them in",
                  "your source code.",
                ]
                  .map((line) => "     " + line)
                  .join("\n") +
                "\n"
            )
          );
        }
      },
      async configureServer(viteDevServer) {
        setDevServerHooks({
          // Give the request handler access to the critical CSS in dev to avoid a
          // flash of unstyled content since Vite injects CSS file contents via JS
          getCriticalCss: async (build, url) => {
            return getStylesForUrl({
              rootDirectory: ctx.rootDirectory,
              entryClientFilePath: ctx.entryClientFilePath,
              remixConfig: ctx.remixConfig,
              viteDevServer,
              cssModulesManifest,
              build,
              url,
            });
          },
          // If an error is caught within the request handler, let Vite fix the
          // stack trace so it maps back to the actual source code
          processRequestError: (error) => {
            if (error instanceof Error) {
              viteDevServer.ssrFixStacktrace(error);
            }
          },
        });

        // Invalidate virtual modules and update cached plugin config via file watcher
        viteDevServer.watcher.on("all", async (eventName, rawFilepath) => {
          let { normalizePath } = importViteEsmSync();
          let filepath = normalizePath(rawFilepath);

          let appFileAddedOrRemoved =
            (eventName === "add" || eventName === "unlink") &&
            filepath.startsWith(normalizePath(ctx.remixConfig.appDirectory));

          invariant(viteConfig?.configFile);
          let viteConfigChanged =
            eventName === "change" &&
            filepath === normalizePath(viteConfig.configFile);

          let routeConfigChanged = Boolean(
            routesViteNodeContext?.devServer?.moduleGraph.getModuleById(
              filepath
            )
          );

          if (routeConfigChanged || appFileAddedOrRemoved) {
            routesViteNodeContext?.devServer?.moduleGraph.invalidateAll();
            routesViteNodeContext?.runner?.moduleCache.clear();
          }

          if (
            appFileAddedOrRemoved ||
            viteConfigChanged ||
            routeConfigChanged
          ) {
            let lastRemixConfig = ctx.remixConfig;

            await updateRemixPluginContext({ routeConfigChanged });

            if (!isEqualJson(lastRemixConfig, ctx.remixConfig)) {
              invalidateVirtualModules(viteDevServer);
            }
          }
        });

        return () => {
          // Let user servers handle SSR requests in middleware mode,
          // otherwise the Vite plugin will handle the request
          if (!viteDevServer.config.server.middlewareMode) {
            viteDevServer.middlewares.use(async (req, res, next) => {
              try {
                let build = (await viteDevServer.ssrLoadModule(
                  serverBuildId
                )) as ServerBuild;

                let handler = createRequestHandler(build, "development");
                let nodeHandler: NodeRequestHandler = async (
                  nodeReq,
                  nodeRes
                ) => {
                  let req = fromNodeRequest(nodeReq, nodeRes);
                  let res = await handler(req, await remixDevLoadContext(req));
                  await toNodeRequest(res, nodeRes);
                };
                await nodeHandler(req, res);
              } catch (error) {
                next(error);
              }
            });
          }
        };
      },
      writeBundle: {
        // After the SSR build is finished, we inspect the Vite manifest for
        // the SSR build and move server-only assets to client assets directory
        async handler() {
          if (!ctx.isSsrBuild) {
            return;
          }

          invariant(viteConfig);

          let clientBuildDirectory = getClientBuildDirectory(ctx.remixConfig);
          let serverBuildDirectory = getServerBuildDirectory(ctx);

          let ssrViteManifest = await loadViteManifest(serverBuildDirectory);
          let ssrAssetPaths = getViteManifestAssetPaths(ssrViteManifest);

          // We only move assets that aren't in the client build, otherwise we
          // remove them. These assets only exist because we explicitly set
          // `ssrEmitAssets: true` in the SSR Vite config. These assets
          // typically wouldn't exist by default, which is why we assume it's
          // safe to remove them. We're aiming for a clean build output so that
          // unnecessary assets don't get deployed alongside the server code.
          let movedAssetPaths: string[] = [];
          for (let ssrAssetPath of ssrAssetPaths) {
            let src = path.join(serverBuildDirectory, ssrAssetPath);
            let dest = path.join(clientBuildDirectory, ssrAssetPath);

            if (!fse.existsSync(dest)) {
              await fse.move(src, dest);
              movedAssetPaths.push(dest);
            } else {
              await fse.remove(src);
            }
          }

          // We assume CSS assets from the SSR build are unnecessary and remove
          // them for the same reasons as above.
          let ssrCssPaths = Object.values(ssrViteManifest).flatMap(
            (chunk) => chunk.css ?? []
          );
          await Promise.all(
            ssrCssPaths.map((cssPath) =>
              fse.remove(path.join(serverBuildDirectory, cssPath))
            )
          );

          if (movedAssetPaths.length) {
            viteConfig.logger.info(
              [
                "",
                `${colors.green("✓")} ${movedAssetPaths.length} asset${
                  movedAssetPaths.length > 1 ? "s" : ""
                } moved from Remix server build to client assets.`,
                ...movedAssetPaths.map((movedAssetPath) =>
                  colors.dim(path.relative(ctx.rootDirectory, movedAssetPath))
                ),
                "",
              ].join("\n")
            );
          }

          if (!ctx.remixConfig.ssr) {
            await handleSpaMode(
              serverBuildDirectory,
              ctx.remixConfig.serverBuildFile,
              clientBuildDirectory,
              viteConfig,
              ctx.remixConfig.basename
            );
          }
        },
      },
      async buildEnd() {
        await viteChildCompiler?.close();
      },
    },
    {
      name: "remix-virtual-modules",
      enforce: "pre",
      resolveId(id) {
        if (vmods.includes(id)) return VirtualModule.resolve(id);
      },
      async load(id) {
        switch (id) {
          case VirtualModule.resolve(serverBuildId): {
            return await getServerEntry();
          }
          case VirtualModule.resolve(serverManifestId): {
            let remixManifest = ctx.isSsrBuild
              ? await ctx.getRemixServerManifest()
              : await getRemixManifestForDev();

            return `export default ${jsesc(remixManifest, { es6: true })};`;
          }
          case VirtualModule.resolve(browserManifestId): {
            if (viteCommand === "build") {
              throw new Error("This module only exists in development");
            }

            let remixManifest = await getRemixManifestForDev();
            let remixManifestString = jsesc(remixManifest, { es6: true });

            return `window.__remixManifest=${remixManifestString};`;
          }
        }
      },
    },
    {
      name: "remix-dot-server",
      enforce: "pre",
      async resolveId(id, importer, options) {
        // https://vitejs.dev/config/dep-optimization-options
        let isOptimizeDeps =
          viteCommand === "serve" &&
          (options as { scan?: boolean })?.scan === true;

        if (options?.ssr || isOptimizeDeps) return;

        let isResolving = options?.custom?.["remix-dot-server"] ?? false;
        if (isResolving) return;
        options.custom = { ...options.custom, "remix-dot-server": true };
        let resolved = await this.resolve(id, importer, options);
        if (!resolved) return;

        let serverFileRE = /\.server(\.[cm]?[jt]sx?)?$/;
        let serverDirRE = /\/\.server\//;
        let isDotServer =
          serverFileRE.test(resolved!.id) || serverDirRE.test(resolved!.id);
        if (!isDotServer) return;

        if (!importer) return;
        if (viteCommand !== "build" && importer.endsWith(".html")) {
          // Vite has a special `index.html` importer for `resolveId` within `transformRequest`
          // https://github.com/vitejs/vite/blob/5684fcd8d27110d098b3e1c19d851f44251588f1/packages/vite/src/node/server/transformRequest.ts#L158
          // https://github.com/vitejs/vite/blob/5684fcd8d27110d098b3e1c19d851f44251588f1/packages/vite/src/node/server/pluginContainer.ts#L668
          return;
        }

        let vite = importViteEsmSync();
        let importerShort = vite.normalizePath(
          path.relative(ctx.rootDirectory, importer)
        );
        let isRoute = getRoute(ctx.remixConfig, importer);

        if (isRoute) {
          let serverOnlyExports = SERVER_ONLY_ROUTE_EXPORTS.map(
            (xport) => `\`${xport}\``
          ).join(", ");
          throw Error(
            [
              colors.red(`Server-only module referenced by client`),
              "",
              `    '${id}' imported by route '${importerShort}'`,
              "",
              `  Remix automatically removes server-code from these exports:`,
              `    ${serverOnlyExports}`,
              "",
              `  But other route exports in '${importerShort}' depend on '${id}'.`,
              "",
              "  See https://remix.run/docs/en/main/guides/vite#splitting-up-client-and-server-code",
              "",
            ].join("\n")
          );
        }

        throw Error(
          [
            colors.red(`Server-only module referenced by client`),
            "",
            `    '${id}' imported by '${importerShort}'`,
            "",
            "  See https://remix.run/docs/en/main/guides/vite#splitting-up-client-and-server-code",
            "",
          ].join("\n")
        );
      },
    },
    {
      name: "remix-dot-client",
      async transform(code, id, options) {
        if (!options?.ssr) return;
        let clientFileRE = /\.client(\.[cm]?[jt]sx?)?$/;
        let clientDirRE = /\/\.client\//;
        if (clientFileRE.test(id) || clientDirRE.test(id)) {
          let exports = esModuleLexer(code)[1];
          return {
            code: exports
              .map(({ n: name }) =>
                name === "default"
                  ? "export default undefined;"
                  : `export const ${name} = undefined;`
              )
              .join("\n"),
            map: null,
          };
        }
      },
    },
    {
      name: "remix-route-exports",
      async transform(code, id, options) {
        if (options?.ssr) return;

        let route = getRoute(ctx.remixConfig, id);
        if (!route) return;

        if (!ctx.remixConfig.ssr) {
          let serverOnlyExports = esModuleLexer(code)[1]
            .map((exp) => exp.n)
            .filter((exp) => SERVER_ONLY_ROUTE_EXPORTS.includes(exp));
          if (serverOnlyExports.length > 0) {
            let str = serverOnlyExports.map((e) => `\`${e}\``).join(", ");
            let message =
              `SPA Mode: ${serverOnlyExports.length} invalid route export(s) in ` +
              `\`${route.file}\`: ${str}. See https://remix.run/guides/spa-mode ` +
              `for more information.`;
            throw Error(message);
          }

          if (route.id !== "root") {
            let hasHydrateFallback = esModuleLexer(code)[1]
              .map((exp) => exp.n)
              .some((exp) => exp === "HydrateFallback");
            if (hasHydrateFallback) {
              let message =
                `SPA Mode: Invalid \`HydrateFallback\` export found in ` +
                `\`${route.file}\`. \`HydrateFallback\` is only permitted on ` +
                `the root route in SPA Mode. See https://remix.run/guides/spa-mode ` +
                `for more information.`;
              throw Error(message);
            }
          }
        }

        let [filepath] = id.split("?");

        return removeExports(code, SERVER_ONLY_ROUTE_EXPORTS, {
          sourceMaps: true,
          filename: id,
          sourceFileName: filepath,
        });
      },
    },
    {
      name: "remix-inject-hmr-runtime",
      enforce: "pre",
      resolveId(id) {
        if (id === injectHmrRuntimeId)
          return VirtualModule.resolve(injectHmrRuntimeId);
      },
      async load(id) {
        if (id !== VirtualModule.resolve(injectHmrRuntimeId)) return;

        return [
          `import RefreshRuntime from "${hmrRuntimeId}"`,
          "RefreshRuntime.injectIntoGlobalHook(window)",
          "window.$RefreshReg$ = () => {}",
          "window.$RefreshSig$ = () => (type) => type",
          "window.__vite_plugin_react_preamble_installed__ = true",
        ].join("\n");
      },
    },
    {
      name: "remix-hmr-runtime",
      enforce: "pre",
      resolveId(id) {
        if (id === hmrRuntimeId) return VirtualModule.resolve(hmrRuntimeId);
      },
      async load(id) {
        if (id !== VirtualModule.resolve(hmrRuntimeId)) return;

        let reactRefreshDir = path.dirname(
          require.resolve("react-refresh/package.json")
        );
        let reactRefreshRuntimePath = path.join(
          reactRefreshDir,
          "cjs/react-refresh-runtime.development.js"
        );

        return [
          "const exports = {}",
          await fse.readFile(reactRefreshRuntimePath, "utf8"),
          await fse.readFile(
            require.resolve("./static/refresh-utils.cjs"),
            "utf8"
          ),
          "export default exports",
        ].join("\n");
      },
    },
    {
      name: "remix-react-refresh-babel",
      async transform(code, id, options) {
        if (viteCommand !== "serve") return;
        if (id.includes("/node_modules/")) return;

        let [filepath] = id.split("?");
        let extensionsRE = /\.(jsx?|tsx?|mdx?)$/;
        if (!extensionsRE.test(filepath)) return;

        let devRuntime = "react/jsx-dev-runtime";
        let ssr = options?.ssr === true;
        let isJSX = filepath.endsWith("x");
        let useFastRefresh = !ssr && (isJSX || code.includes(devRuntime));
        if (!useFastRefresh) return;

        let result = await babel.transformAsync(code, {
          configFile: false,
          babelrc: false,
          filename: id,
          sourceFileName: filepath,
          parserOpts: {
            sourceType: "module",
            allowAwaitOutsideFunction: true,
          },
          plugins: [[require("react-refresh/babel"), { skipEnvCheck: true }]],
          sourceMaps: true,
        });
        if (result === null) return;

        code = result.code!;
        let refreshContentRE = /\$Refresh(?:Reg|Sig)\$\(/;
        if (refreshContentRE.test(code)) {
          code = addRefreshWrapper(ctx.remixConfig, code, id);
        }
        return { code, map: result.map };
      },
    },
    {
      name: "remix-hmr-updates",
      async handleHotUpdate({ server, file, modules, read }) {
        let route = getRoute(ctx.remixConfig, file);

        type ManifestRoute = RemixManifest["routes"][string];
        type HmrEventData = { route: ManifestRoute | null };
        let hmrEventData: HmrEventData = { route: null };

        if (route) {
          // invalidate manifest on route exports change
          let serverManifest = (await server.ssrLoadModule(serverManifestId))
            .default as RemixManifest;

          let oldRouteMetadata = serverManifest.routes[route.id];
          let newRouteMetadata = await getRouteMetadata(
            ctx,
            viteChildCompiler,
            route,
            read
          );

          hmrEventData.route = newRouteMetadata;

          if (
            !oldRouteMetadata ||
            (
              [
                "hasLoader",
                "hasClientLoader",
                "hasAction",
                "hasClientAction",
                "hasErrorBoundary",
              ] as const
            ).some((key) => oldRouteMetadata[key] !== newRouteMetadata[key])
          ) {
            invalidateVirtualModules(server);
          }
        }

        server.ws.send({
          type: "custom",
          event: "remix:hmr",
          data: hmrEventData,
        });

        return modules;
      },
    },
  ];
};

function isInRemixMonorepo() {
  let devPath = path.dirname(require.resolve("@remix-run/dev/package.json"));
  let devParentDir = path.basename(path.resolve(devPath, ".."));
  return devParentDir === "packages";
}

function isEqualJson(v1: unknown, v2: unknown) {
  return JSON.stringify(v1) === JSON.stringify(v2);
}

function addRefreshWrapper(
  remixConfig: ResolvedVitePluginConfig,
  code: string,
  id: string
): string {
  let route = getRoute(remixConfig, id);
  let acceptExports = route
    ? [
        "clientAction",
        "clientLoader",
        "handle",
        "meta",
        "links",
        "shouldRevalidate",
      ]
    : [];
  return (
    REACT_REFRESH_HEADER.replaceAll("__SOURCE__", JSON.stringify(id)) +
    code +
    REACT_REFRESH_FOOTER.replaceAll("__SOURCE__", JSON.stringify(id))
      .replaceAll("__ACCEPT_EXPORTS__", JSON.stringify(acceptExports))
      .replaceAll("__ROUTE_ID__", JSON.stringify(route?.id))
  );
}

const REACT_REFRESH_HEADER = `
import RefreshRuntime from "${hmrRuntimeId}";

const inWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;

if (import.meta.hot && !inWebWorker) {
  if (!window.__vite_plugin_react_preamble_installed__) {
    throw new Error(
      "Remix Vite plugin can't detect preamble. Something is wrong."
    );
  }

  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = (type, id) => {
    RefreshRuntime.register(type, __SOURCE__ + " " + id)
  };
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}`.replace(/\n+/g, "");

const REACT_REFRESH_FOOTER = `
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh(__SOURCE__, currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      __ROUTE_ID__ && window.__remixRouteModuleUpdates.set(__ROUTE_ID__, nextExports);
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate(currentExports, nextExports, __ACCEPT_EXPORTS__);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}`;

function getRoute(
  pluginConfig: ResolvedVitePluginConfig,
  file: string
): RouteManifestEntry | undefined {
  let vite = importViteEsmSync();
  let routePath = vite.normalizePath(
    path.relative(pluginConfig.appDirectory, file)
  );
  let route = Object.values(pluginConfig.routes).find(
    (r) => vite.normalizePath(r.file) === routePath
  );
  return route;
}

async function getRouteMetadata(
  ctx: RemixPluginContext,
  viteChildCompiler: Vite.ViteDevServer | null,
  route: RouteManifestEntry,
  readRouteFile?: () => string | Promise<string>
) {
  let sourceExports = await getRouteModuleExports(
    viteChildCompiler,
    ctx,
    route.file,
    readRouteFile
  );

  let info = {
    id: route.id,
    parentId: route.parentId,
    path: route.path,
    index: route.index,
    caseSensitive: route.caseSensitive,
    url: combineURLs(
      ctx.remixConfig.publicPath,
      "/" +
        path.relative(
          ctx.rootDirectory,
          resolveRelativeRouteFilePath(route, ctx.remixConfig)
        )
    ),
    module: combineURLs(
      ctx.remixConfig.publicPath,
      `${resolveFileUrl(
        ctx,
        resolveRelativeRouteFilePath(route, ctx.remixConfig)
      )}?import`
    ), // Ensure the Vite dev server responds with a JS module
    hasAction: sourceExports.includes("action"),
    hasClientAction: sourceExports.includes("clientAction"),
    hasLoader: sourceExports.includes("loader"),
    hasClientLoader: sourceExports.includes("clientLoader"),
    hasErrorBoundary: sourceExports.includes("ErrorBoundary"),
    imports: [],
  };
  return info;
}

async function handleSpaMode(
  serverBuildDirectoryPath: string,
  serverBuildFile: string,
  clientBuildDirectory: string,
  viteConfig: Vite.ResolvedConfig,
  basename: string
) {
  // Create a handler and call it for the `/` path - rendering down to the
  // proper HydrateFallback ... or not!  Maybe they have a static landing page
  // generated from routes/_index.tsx.
  let serverBuildPath = path.join(serverBuildDirectoryPath, serverBuildFile);
  let build = await import(url.pathToFileURL(serverBuildPath).toString());
  let { createRequestHandler: createHandler } = await import("@remix-run/node");
  let handler = createHandler(build, viteConfig.mode);
  let response = await handler(new Request(`http://localhost${basename}`));
  let html = await response.text();
  if (response.status !== 200) {
    throw new Error(
      `SPA Mode: Received a ${response.status} status code from ` +
        `\`entry.server.tsx\` while generating the \`index.html\` file.\n${html}`
    );
  }

  if (
    !html.includes("window.__remixContext =") ||
    !html.includes("window.__remixRouteModules =")
  ) {
    throw new Error(
      "SPA Mode: Did you forget to include <Scripts/> in your `root.tsx` " +
        "`HydrateFallback` component?  Your `index.html` file cannot hydrate " +
        "into a SPA without `<Scripts />`."
    );
  }

  // Write out the index.html file for the SPA
  await fse.writeFile(path.join(clientBuildDirectory, "index.html"), html);

  viteConfig.logger.info(
    "SPA Mode: index.html has been written to your " +
      colors.bold(path.relative(process.cwd(), clientBuildDirectory)) +
      " directory"
  );

  // Cleanup - we no longer need the server build assets
  fse.removeSync(serverBuildDirectoryPath);
}
