import { promises as fsp } from "fs";
import * as path from "path";
import { builtinModules as nodeBuiltins } from "module";
import * as esbuild from "esbuild";
import debounce from "lodash.debounce";
import chokidar from "chokidar";

import { BuildMode, BuildTarget } from "./build";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import invariant from "./invariant";
import { createAssetsManifest } from "./compiler2/assets";
import { getAppDependencies } from "./compiler2/dependencies";
import { loaders, getLoaderForFile } from "./compiler2/loaders";
import { getRouteExportsCached } from "./compiler2/routes";
import { writeFileSafe } from "./compiler2/utils/fs";

// When we build Remix, this shim file is copied directly into the output
// directory in the same place relative to this file. It is eventually injected
// as a source file when building the app.
const reactShim = path.resolve(__dirname, "compiler2/shims/react.ts");

interface BuildOptions {
  mode: BuildMode;
  target: BuildTarget;
}

export async function build(
  config: RemixConfig,
  {
    mode = BuildMode.Production,
    target = BuildTarget.Node14
  }: Partial<BuildOptions> = {}
): Promise<void> {
  await buildEverything(config, { mode, target });
}

interface WatchOptions extends BuildOptions {
  onRebuildStart?(): void;
  onRebuildFinish?(): void;
  onFileCreated?(file: string): void;
  onFileChanged?(file: string): void;
  onFileDeleted?(file: string): void;
}

export async function watch(
  config: RemixConfig,
  {
    mode = BuildMode.Development,
    target = BuildTarget.Node14,
    onRebuildStart,
    onRebuildFinish,
    onFileCreated,
    onFileChanged,
    onFileDeleted
  }: Partial<WatchOptions> = {}
): Promise<() => void> {
  let options = { mode, target, incremental: true };
  let [browserBuild, serverBuild] = await buildEverything(config, options);

  async function disposeBuilders() {
    await Promise.all([
      browserBuild.rebuild?.dispose(),
      serverBuild.rebuild?.dispose()
    ]);
  }

  let restartBuilders = debounce(async (newConfig?: RemixConfig) => {
    await disposeBuilders();
    config = newConfig || (await readConfig(config.rootDirectory));
    if (onRebuildStart) onRebuildStart();
    let builders = await buildEverything(config, options);
    if (onRebuildFinish) onRebuildFinish();
    browserBuild = builders[0];
    serverBuild = builders[1];
  }, 500);

  let rebuildEverything = debounce(async () => {
    if (onRebuildStart) onRebuildStart();
    await Promise.all([
      browserBuild.rebuild!().then(build =>
        generateManifests(config, options, build.metafile!)
      ),
      serverBuild.rebuild!()
    ]);
    if (onRebuildFinish) onRebuildFinish();
  }, 100);

  let watcher = chokidar
    .watch(config.appDirectory, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    })
    .on("error", error => console.error(error))
    .on("change", async file => {
      if (onFileChanged) onFileChanged(file);
      await rebuildEverything();
    })
    .on("add", async file => {
      if (onFileCreated) onFileCreated(file);
      let newConfig = await readConfig(config.rootDirectory);
      if (isEntryPoint(newConfig, file)) {
        await restartBuilders(newConfig);
      } else {
        await rebuildEverything();
      }
    })
    .on("unlink", async file => {
      if (onFileDeleted) onFileDeleted(file);
      if (isEntryPoint(config, file)) {
        await restartBuilders();
      } else {
        await rebuildEverything();
      }
    });

  return async () => {
    await watcher.close();
    await disposeBuilders();
  };
}

function isEntryPoint(config: RemixConfig, file: string) {
  let appFile = path.relative(config.appDirectory, file);

  if (
    appFile === config.entryClientFile ||
    appFile === config.entryServerFile
  ) {
    return true;
  }
  for (let key in config.routes) {
    if (appFile === config.routes[key].file) return true;
  }

  return false;
}

///////////////////////////////////////////////////////////////////////////////

async function buildEverything(
  config: RemixConfig,
  options: BuildOptions & { incremental?: boolean }
): Promise<esbuild.BuildResult[]> {
  let appDeps = Object.keys(await getAppDependencies(config));

  // TODO:
  // When building for node, we build both the browser and server builds in
  // parallel and emit the asset manifest as a separate file in the output
  // directory.
  // When building for Cloudflare Workers, we need to run the browser and server
  // builds serially so we can inline the asset manifest into the server build
  // in a single JavaScript file.

  let browserBuildPromise = createBrowserBuild(config, options, appDeps);
  let serverBuildPromise = createServerBuild(config, options, appDeps);

  return Promise.all([
    browserBuildPromise.then(async build => {
      await generateManifests(config, options, build.metafile!);
      return build;
    }),
    serverBuildPromise
  ]);
}

function createBrowserBuild(
  config: RemixConfig,
  options: BuildOptions & { incremental?: boolean },
  dependencies: string[]
): Promise<esbuild.BuildResult> {
  // For the browser build, exclude node built-ins that don't have a
  // browser-safe alternative installed in node_modules. Nothing should
  // *actually* be external in the browser build (we want to bundle all deps) so
  // this is really just making sure we don't accidentally have any dependencies
  // on node built-ins in browser bundles.
  let externals = nodeBuiltins.filter(mod => !dependencies.includes(mod));

  return esbuild.build({
    entryPoints: [
      path.resolve(config.appDirectory, config.entryClientFile),
      // All route entry points are virtual modules that will be loaded by the
      // browserEntryPointsPlugin. This allows us to tree-shake server-only code
      // that we don't want to run in the browser (i.e. action & loader).
      ...Object.keys(config.routes).map(
        key =>
          path.resolve(config.appDirectory, config.routes[key].file) +
          "?browser"
      )
    ],
    outdir: config.assetsBuildDirectory,
    format: "esm",
    external: externals,
    inject: [reactShim],
    loader: loaders,
    bundle: true,
    splitting: true,
    metafile: true,
    incremental: options.incremental,
    minify: options.mode === BuildMode.Production,
    entryNames: "[name]-[hash]",
    chunkNames: "shared/[name]-[hash]",
    assetNames: "assets/[name]-[hash]",
    publicPath: config.publicPath,
    define: {
      "process.env.NODE_ENV": JSON.stringify(options.mode)
    },
    plugins: [
      emptyRouteModulesPlugin(config),
      browserRouteModulesPlugin(config)
    ]
  });
}

function createServerBuild(
  config: RemixConfig,
  options: BuildOptions & { incremental?: boolean },
  dependencies: string[]
): Promise<esbuild.BuildResult> {
  let externals: string[];
  switch (options.target) {
    case BuildTarget.Node14:
      externals = nodeBuiltins
        .concat(dependencies)
        // We need to bundle @remix-run/react because it is ESM and we can't
        // require it from the CommonJS output.
        .filter(dep => dep !== "@remix-run/react")
        // assets.json is external because this build runs in parallel with the
        // browser build and it's not there yet.
        .concat(path.resolve(config.serverBuildDirectory, "assets.json"));
      break;
    default:
      throw new Error(`Unknown build target: ${options.target}`);
  }

  return esbuild.build({
    stdin: {
      contents: getServerEntryPointModule(config, options),
      resolveDir: config.serverBuildDirectory
    },
    outfile: path.resolve(config.serverBuildDirectory, "index.js"),
    format: "cjs",
    platform: "node",
    target: options.target,
    external: externals,
    inject: [reactShim],
    loader: loaders,
    bundle: true,
    incremental: options.incremental,
    // The server build needs to know how to generate asset URLs for imports
    // of CSS and other files.
    assetNames: "assets/[name]-[hash]",
    publicPath: config.publicPath,
    plugins: [emptyRouteModulesPlugin(config)]
  });
}

async function generateManifests(
  config: RemixConfig,
  options: BuildOptions,
  metafile: esbuild.Metafile
): Promise<string[]> {
  let assetsManifest = await createAssetsManifest(config, metafile);

  let filename = `manifest-${assetsManifest.version}.js`;
  assetsManifest.url = config.publicPath + filename;

  return Promise.all([
    writeFileSafe(
      path.join(config.assetsBuildDirectory, filename),
      `window.__remixManifest=${JSON.stringify(assetsManifest)}`
    ),
    writeFileSafe(
      path.join(config.serverBuildDirectory, "assets.json"),
      JSON.stringify(assetsManifest, null, 2)
    )
  ]);
}

type Route = RemixConfig["routes"][string];

const browserSafeRouteExports: { [name: string]: boolean } = {
  ErrorBoundary: true,
  default: true,
  handle: true,
  links: true,
  meta: true
};

/**
 * This plugin loads route modules for the browser build, using module shims
 * that export only thing that are safe for the browser.
 */
function browserRouteModulesPlugin(config: RemixConfig): esbuild.Plugin {
  return {
    name: "browser-route-modules",
    async setup(build) {
      let routesByFile: Map<string, Route> = Object.keys(config.routes).reduce(
        (map, key) => {
          let route = config.routes[key];
          map.set(path.resolve(config.appDirectory, route.file), route);
          return map;
        },
        new Map()
      );

      build.onResolve({ filter: /\?browser$/ }, args => {
        return { path: args.path, namespace: "browser-route-module" };
      });

      build.onLoad(
        { filter: /\?browser$/, namespace: "browser-route-module" },
        async args => {
          let file = args.path.replace(/\?browser$/, "");
          let route = routesByFile.get(file);
          invariant(route, `Cannot get route by path: ${args.path}`);

          let exports = (await getRouteExportsCached(config, route.id)).filter(
            ex => !!browserSafeRouteExports[ex]
          );
          let spec = exports.length > 0 ? `{ ${exports.join(", ")} }` : "*";
          let contents = `export ${spec} from ${JSON.stringify(file)};`;

          return {
            contents,
            resolveDir: path.dirname(file),
            loader: "js"
          };
        }
      );
    }
  };
}

/**
 * This plugin loads route modules so we can handle newly created files
 * gracefully.
 */
function emptyRouteModulesPlugin(config: RemixConfig): esbuild.Plugin {
  return {
    name: "empty-route-modules",
    setup(build) {
      let routeFiles = new Set(
        Object.keys(config.routes).map(key => config.routes[key].file)
      );

      build.onResolve({ filter: /.*/ }, args => {
        if (routeFiles.has(args.path)) {
          return { path: args.path, namespace: "route-module" };
        }
      });

      build.onLoad({ filter: /.*/, namespace: "route-module" }, async args => {
        let file = args.path;
        let contents = await fsp.readFile(file, "utf-8");

        if (contents.length === 0) {
          // In dev mode, when a new file is created we use `export {}` to work
          // around an issue with esbuild where it uses `{ default: {} }`
          // instead. Otherwise we wouldn't need this plugin at all!
          // See https://github.com/evanw/esbuild/issues/1043
          return { contents: "export {}", loader: "js" };
        }

        return {
          contents,
          resolveDir: path.dirname(file),
          loader: getLoaderForFile(file)
        };
      });
    }
  };
}

function getServerEntryPointModule(
  config: RemixConfig,
  options: BuildOptions
): string {
  switch (options.target) {
    case BuildTarget.Node14:
      return `
import * as entryServer from ${JSON.stringify(
        path.resolve(config.appDirectory, config.entryServerFile)
      )};
${Object.keys(config.routes)
  .map((key, index) => {
    let route = config.routes[key];
    return `import * as route${index} from ${JSON.stringify(
      path.resolve(config.appDirectory, route.file)
    )};`;
  })
  .join("\n")}
export { default as assets } from "./assets.json";
export const entry = { module: entryServer };
export const routes = {
  ${Object.keys(config.routes)
    .map((key, index) => {
      let route = config.routes[key];
      return `${JSON.stringify(key)}: {
    id: ${JSON.stringify(route.id)},
    parentId: ${JSON.stringify(route.parentId)},
    path: ${JSON.stringify(route.path)},
    caseSensitive: ${JSON.stringify(route.caseSensitive)},
    module: route${index}
  }`;
    })
    .join(",\n  ")}
};`;
    default:
      throw new Error(
        `Cannot generate server entry point module for target: ${options.target}`
      );
  }
}
