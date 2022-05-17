import * as path from "path";
import { builtinModules as nodeBuiltins } from "module";
import * as esbuild from "esbuild";
import * as fse from "fs-extra";
import debounce from "lodash.debounce";
import chokidar from "chokidar";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

import { BuildMode, BuildTarget } from "./build";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import { warnOnce } from "./compiler/warnings";
import type { AssetsManifest } from "./compiler/assets";
import { createAssetsManifest } from "./compiler/assets";
import { getAppDependencies } from "./compiler/dependencies";
import { loaders } from "./compiler/loaders";
import { browserRouteModulesPlugin } from "./compiler/plugins/browserRouteModulesPlugin";
import { emptyModulesPlugin } from "./compiler/plugins/emptyModulesPlugin";
import { mdxPlugin } from "./compiler/plugins/mdx";
import type { AssetsManifestPromiseRef } from "./compiler/plugins/serverAssetsManifestPlugin";
import { serverAssetsManifestPlugin } from "./compiler/plugins/serverAssetsManifestPlugin";
import { serverBareModulesPlugin } from "./compiler/plugins/serverBareModulesPlugin";
import { serverEntryModulePlugin } from "./compiler/plugins/serverEntryModulePlugin";
import { serverRouteModulesPlugin } from "./compiler/plugins/serverRouteModulesPlugin";
import type { CssModulesResults } from "./compiler/plugins/cssModulesPlugin";
import {
  cssModulesPlugin,
  cssModulesFakerPlugin,
  getCssModulesFileReferences,
  processCss,
} from "./compiler/plugins/cssModulesPlugin";
import { writeFileSafe } from "./compiler/utils/fs";

// When we build Remix, this shim file is copied directly into the output
// directory in the same place relative to this file. It is eventually injected
// as a source file when building the app.
const reactShim = path.resolve(__dirname, "compiler/shims/react.ts");

interface BuildConfig {
  mode: BuildMode;
  target: BuildTarget;
  sourcemap: boolean;
}

function defaultWarningHandler(message: string, key: string) {
  warnOnce(message, key);
}

export type BuildError = Error | esbuild.BuildFailure;
function defaultBuildFailureHandler(failure: BuildError) {
  formatBuildFailure(failure);
}

export function formatBuildFailure(failure: BuildError) {
  if ("warnings" in failure || "errors" in failure) {
    if (failure.warnings) {
      let messages = esbuild.formatMessagesSync(failure.warnings, {
        kind: "warning",
        color: true,
      });
      console.warn(...messages);
    }

    if (failure.errors) {
      let messages = esbuild.formatMessagesSync(failure.errors, {
        kind: "error",
        color: true,
      });
      console.error(...messages);
    }
  }

  console.error(failure?.message || "An unknown build error occurred");
}

interface BuildOptions extends Partial<BuildConfig> {
  onWarning?(message: string, key: string): void;
  onBuildFailure?(failure: Error | esbuild.BuildFailure): void;
}

export async function build(
  config: RemixConfig,
  {
    mode = BuildMode.Production,
    target = BuildTarget.Node14,
    sourcemap = false,
    onWarning = defaultWarningHandler,
    onBuildFailure = defaultBuildFailureHandler,
  }: BuildOptions = {}
): Promise<void> {
  let assetsManifestPromiseRef: AssetsManifestPromiseRef = {};

  await buildEverything(config, assetsManifestPromiseRef, {
    mode,
    target,
    sourcemap,
    onWarning,
    onBuildFailure,
  });
}

interface WatchOptions extends BuildOptions {
  onRebuildStart?(): void;
  onRebuildFinish?(): void;
  onFileCreated?(file: string): void;
  onFileChanged?(file: string): void;
  onFileDeleted?(file: string): void;
  onInitialBuild?(): void;
}

export async function watch(
  config: RemixConfig,
  {
    mode = BuildMode.Development,
    target = BuildTarget.Node14,
    sourcemap = true,
    onWarning = defaultWarningHandler,
    onBuildFailure = defaultBuildFailureHandler,
    onRebuildStart,
    onRebuildFinish,
    onFileCreated,
    onFileChanged,
    onFileDeleted,
    onInitialBuild,
  }: WatchOptions = {}
): Promise<() => Promise<void>> {
  let options = {
    mode,
    target,
    sourcemap,
    onBuildFailure,
    onWarning,
    incremental: true,
  };

  let assetsManifestPromiseRef: AssetsManifestPromiseRef = {};
  let [browserBuild, serverBuild] = await buildEverything(
    config,
    assetsManifestPromiseRef,
    options
  );

  let initialBuildComplete = !!browserBuild && !!serverBuild;
  if (initialBuildComplete) {
    onInitialBuild?.();
  }

  function disposeBuilders() {
    browserBuild?.rebuild?.dispose();
    serverBuild?.rebuild?.dispose();
    browserBuild = undefined;
    serverBuild = undefined;
  }

  let restartBuilders = debounce(async (newConfig?: RemixConfig) => {
    disposeBuilders();
    try {
      newConfig = await readConfig(config.rootDirectory);
    } catch (error) {
      onBuildFailure(error as Error);
      return;
    }

    config = newConfig;
    if (onRebuildStart) onRebuildStart();
    let builders = await buildEverything(
      config,
      assetsManifestPromiseRef,
      options
    );
    if (onRebuildFinish) onRebuildFinish();
    [browserBuild, serverBuild] = builders;
  }, 500);

  let rebuildEverything = debounce(async () => {
    if (onRebuildStart) onRebuildStart();

    if (!browserBuild?.rebuild || !serverBuild?.rebuild) {
      disposeBuilders();

      try {
        [browserBuild, serverBuild] = await buildEverything(
          config,
          assetsManifestPromiseRef,
          options
        );

        if (!initialBuildComplete) {
          initialBuildComplete = !!browserBuild && !!serverBuild;
          if (initialBuildComplete) {
            onInitialBuild?.();
          }
        }
        if (onRebuildFinish) onRebuildFinish();
      } catch (err: any) {
        onBuildFailure(err);
      }
      return;
    }

    // If we get here and can't call rebuild something went wrong and we
    // should probably blow as it's not really recoverable.
    let browserBuildPromise = browserBuild.rebuild();
    let assetsManifestPromise = browserBuildPromise.then((build) =>
      generateAssetsManifest(config, build.metafile!, build.cssModules)
    );

    // Assign the assetsManifestPromise to a ref so the server build can await
    // it when loading the @remix-run/dev/assets-manifest virtual module.
    assetsManifestPromiseRef.current = assetsManifestPromise;

    await Promise.all([
      assetsManifestPromise,
      serverBuild
        .rebuild()
        .then((build) => writeServerBuildResult(config, build.outputFiles!)),
    ]).catch((err) => {
      disposeBuilders();
      onBuildFailure(err);
    });
    if (onRebuildFinish) onRebuildFinish();
  }, 100);

  let toWatch = [config.appDirectory];
  if (config.serverEntryPoint) {
    toWatch.push(config.serverEntryPoint);
  }

  let watcher = chokidar
    .watch(toWatch, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    })
    .on("error", (error) => console.error(error))
    .on("change", async (file) => {
      if (onFileChanged) onFileChanged(file);
      await rebuildEverything();
    })
    .on("add", async (file) => {
      if (onFileCreated) onFileCreated(file);
      let newConfig: RemixConfig;
      try {
        newConfig = await readConfig(config.rootDirectory);
      } catch (error) {
        onBuildFailure(error as Error);
        return;
      }

      if (isEntryPoint(newConfig, file)) {
        await restartBuilders(newConfig);
      } else {
        await rebuildEverything();
      }
    })
    .on("unlink", async (file) => {
      if (onFileDeleted) onFileDeleted(file);
      if (isEntryPoint(config, file)) {
        await restartBuilders();
      } else {
        await rebuildEverything();
      }
    });

  return async () => {
    await watcher.close().catch(() => {});
    disposeBuilders();
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

interface ServerBuild extends esbuild.BuildResult {}

interface BuildInvalidate {
  (): Promise<BrowserBuildIncremental>;
  dispose(): void;
}
export interface BrowserBuild extends Omit<esbuild.BuildResult, "rebuild"> {
  cssModules: CssModulesResults;
  rebuild?: BuildInvalidate;
}

interface BrowserBuildIncremental extends BrowserBuild {
  rebuild: BuildInvalidate;
}

async function buildEverything(
  config: RemixConfig,
  assetsManifestPromiseRef: AssetsManifestPromiseRef,
  options: Required<BuildOptions> & { incremental?: boolean }
): Promise<[BrowserBuild | undefined, ServerBuild | undefined]> {
  try {
    let browserBuildPromise = createBrowserBuild(config, options);

    let assetsManifestPromise = browserBuildPromise.then((build) =>
      generateAssetsManifest(config, build.metafile!, build.cssModules)
    );

    // Assign the assetsManifestPromise to a ref so the server build can await
    // it when loading the @remix-run/dev/assets-manifest virtual module.
    assetsManifestPromiseRef.current = assetsManifestPromise;

    let serverBuildPromise = createServerBuild(
      config,
      options,
      assetsManifestPromiseRef
    );

    return await Promise.all([
      assetsManifestPromise.then(() => browserBuildPromise),
      serverBuildPromise,
    ]);
  } catch (err) {
    options.onBuildFailure(err as Error);
    return [undefined, undefined];
  }
}

async function createBrowserBuild(
  config: RemixConfig,
  options: BuildOptions & { incremental?: boolean }
): Promise<BrowserBuild> {
  // For the browser build, exclude node built-ins that don't have a
  // browser-safe alternative installed in node_modules. Nothing should
  // *actually* be external in the browser build (we want to bundle all deps) so
  // this is really just making sure we don't accidentally have any dependencies
  // on node built-ins in browser bundles.
  let dependencies = Object.keys(getAppDependencies(config));
  let externals = nodeBuiltins.filter((mod) => !dependencies.includes(mod));
  let fakeBuiltins = nodeBuiltins.filter((mod) => dependencies.includes(mod));

  if (fakeBuiltins.length > 0) {
    throw new Error(
      `It appears you're using a module that is built in to node, but you installed it as a dependency which could cause problems. Please remove ${fakeBuiltins.join(
        ", "
      )} before continuing.`
    );
  }

  let entryPoints: esbuild.BuildOptions["entryPoints"] = {
    "entry.client": path.resolve(config.appDirectory, config.entryClientFile),
  };
  for (let id of Object.keys(config.routes)) {
    // All route entry points are virtual modules that will be loaded by the
    // browserEntryPointsPlugin. This allows us to tree-shake server-only code
    // that we don't want to run in the browser (i.e. action & loader).
    entryPoints[id] =
      path.resolve(config.appDirectory, config.routes[id].file) + "?browser";
  }

  let plugins = [
    cssModulesPlugin(config),
    mdxPlugin(config),
    browserRouteModulesPlugin(config, /\?browser$/),
    emptyModulesPlugin(config, /\.server(\.[jt]sx?)?$/),
    NodeModulesPolyfillPlugin(),
  ];

  if (config.serverBuildTarget === "deno") {
    // @ts-expect-error
    let { cache } = await import("esbuild-plugin-cache");
    plugins.unshift(
      cache({
        importmap: {},
        directory: path.join(config.cacheDirectory, "http-import-cache"),
      })
    );
  }

  return esbuild
    .build({
      entryPoints,
      outdir: config.assetsBuildDirectory,
      platform: "browser",
      format: "esm",
      external: externals,
      inject: config.serverBuildTarget === "deno" ? [] : [reactShim],
      loader: loaders,
      bundle: true,
      logLevel: "silent",
      splitting: true,
      sourcemap: options.sourcemap,
      metafile: true,
      incremental: options.incremental,
      mainFields: ["browser", "module", "main"],
      treeShaking: true,
      minify: options.mode === BuildMode.Production,
      entryNames: "[dir]/[name]-[hash]",
      chunkNames: "_shared/[name]-[hash]",
      assetNames: "_assets/[name]-[hash]",
      publicPath: config.publicPath,
      define: {
        "process.env.NODE_ENV": JSON.stringify(options.mode),
        "process.env.REMIX_DEV_SERVER_WS_PORT": JSON.stringify(
          config.devServerPort
        ),
      },
      plugins,
    })
    .then(async (build) => {
      // Model files and their imports as an adjacency list
      // https://en.wikipedia.org/wiki/Adjacency_list
      // E.g. "Module A imports from B, C, and D" becomes `{A:[B,C,D]}`
      let graph = Object.fromEntries(
        Object.entries(build.metafile.inputs).map(([input, { imports }]) => {
          return [input, imports.map(({ path }) => path)];
        })
      );

      // Order CSS Modules based on the module that imported them
      let componentFiles = topologicalSort(graph, {
        filterEdges: (node) => node.startsWith("css-modules-namespace:"),
      });

      let cssModules: string[] = [];
      for (let componentFile of componentFiles) {
        let imports = graph[componentFile];
        for (let imported of imports) {
          if (
            imported.endsWith(".module.css") &&
            !cssModules.includes(imported)
          ) {
            cssModules.push(imported);
          }
        }
      }

      let cssModulesContent = "";
      let cssModulesMap = Object.fromEntries(
        await Promise.all(
          cssModules.map(async (filePath) => {
            filePath = filePath.replace(/^css-modules-namespace:/, "");
            let processed = await processCss({ config, filePath });
            cssModulesContent += processed.css;
            return [filePath, processed] as const;
          })
        )
      );

      let [globalStylesheetFilePath, globalStylesheetFileUrl] =
        getCssModulesFileReferences(config, cssModulesContent);

      await fse.ensureDir(path.dirname(globalStylesheetFilePath));
      await fse.writeFile(globalStylesheetFilePath, cssModulesContent);

      return {
        ...build,
        // This is a bit gnarly, but because the watch function calls `rebuild`
        // on everything we need to essentially re-write it to ensure that we
        // process CSS Modules, update our local state, and write to disk. This
        // may have implications for LiveReload, so we should definitely test
        // that.
        rebuild: (() => {
          // TODO support rebuild
          if (!options.incremental) {
            return undefined;
          }
          let builder = (async () => {
            // Clear CSS modules data before rebuild
            cssModulesContent = "";
            cssModulesMap = {};
            let result = await build.rebuild!();
            let [globalStylesheetFilePath, globalStylesheetFileUrl] =
              getCssModulesFileReferences(config, cssModulesContent);

            await fse.ensureDir(path.dirname(globalStylesheetFilePath));
            await fse.writeFile(globalStylesheetFilePath, cssModulesContent);

            return {
              ...result,
              rebuild: builder,
              cssModules: {
                globalStylesheetFilePath,
                globalStylesheetFileUrl,
                moduleMap: cssModulesMap,
              },
            };
          }) as BuildInvalidate;
          // TODO: unsure about this, check back w/ esbuild docs to clarify what
          // dispose is doing and see if we need to clear any internal state
          builder.dispose = build.rebuild!.dispose;
          return builder;
        })(),
        cssModules: {
          globalStylesheetFilePath,
          globalStylesheetFileUrl,
          moduleMap: cssModulesMap,
        },
      };
    });
}

function createServerBuild(
  config: RemixConfig,
  options: Required<BuildOptions> & { incremental?: boolean },
  assetsManifestPromiseRef: AssetsManifestPromiseRef
): Promise<ServerBuild> {
  let dependencies = getAppDependencies(config);

  let stdin: esbuild.StdinOptions | undefined;
  let entryPoints: string[] | undefined;

  if (config.serverEntryPoint) {
    entryPoints = [config.serverEntryPoint];
  } else {
    stdin = {
      contents: config.serverBuildTargetEntryModule,
      resolveDir: config.rootDirectory,
      loader: "ts",
    };
  }

  let isCloudflareRuntime = ["cloudflare-pages", "cloudflare-workers"].includes(
    config.serverBuildTarget ?? ""
  );
  let plugins: esbuild.Plugin[] = [
    cssModulesFakerPlugin(config, assetsManifestPromiseRef),
    mdxPlugin(config),
    emptyModulesPlugin(config, /\.client(\.[jt]sx?)?$/),
    serverRouteModulesPlugin(config),
    serverEntryModulePlugin(config),
    serverAssetsManifestPlugin(assetsManifestPromiseRef),
    serverBareModulesPlugin(config, dependencies, options.onWarning),
  ];

  if (config.serverPlatform !== "node") {
    plugins.unshift(NodeModulesPolyfillPlugin());
  }

  return esbuild
    .build({
      absWorkingDir: config.rootDirectory,
      stdin,
      entryPoints,
      outfile: config.serverBuildPath,
      write: false,
      conditions: isCloudflareRuntime ? ["worker"] : undefined,
      platform: config.serverPlatform,
      format: config.serverModuleFormat,
      treeShaking: true,
      minify: options.mode === BuildMode.Production && isCloudflareRuntime,
      mainFields: isCloudflareRuntime
        ? ["browser", "module", "main"]
        : config.serverModuleFormat === "esm"
        ? ["module", "main"]
        : ["main", "module"],
      target: options.target,
      inject: config.serverBuildTarget === "deno" ? [] : [reactShim],
      loader: loaders,
      bundle: true,
      logLevel: "silent",
      incremental: options.incremental,
      sourcemap: options.sourcemap, // use linked (true) to fix up .map file
      // The server build needs to know how to generate asset URLs for imports
      // of CSS and other files.
      assetNames: "_assets/[name]-[hash]",
      publicPath: config.publicPath,
      define: {
        "process.env.NODE_ENV": JSON.stringify(options.mode),
        "process.env.REMIX_DEV_SERVER_WS_PORT": JSON.stringify(
          config.devServerPort
        ),
      },
      plugins,
    })
    .then(async (build) => {
      await writeServerBuildResult(config, build.outputFiles);
      return build;
    });
}

async function generateAssetsManifest(
  config: RemixConfig,
  metafile: esbuild.Metafile,
  cssModules: CssModulesResults | undefined
): Promise<AssetsManifest> {
  let assetsManifest = await createAssetsManifest(
    config,
    metafile!,
    cssModules
  );
  let filename = `manifest-${assetsManifest.version.toUpperCase()}.js`;

  assetsManifest.url = config.publicPath + filename;

  await writeFileSafe(
    path.join(config.assetsBuildDirectory, filename),
    `window.__remixManifest=${JSON.stringify(assetsManifest)};`
  );

  return assetsManifest;
}

async function writeServerBuildResult(
  config: RemixConfig,
  outputFiles: esbuild.OutputFile[]
) {
  await fse.ensureDir(path.dirname(config.serverBuildPath));

  for (let file of outputFiles) {
    if (file.path.endsWith(".js")) {
      // fix sourceMappingURL to be relative to current path instead of /build
      let filename = file.path.substring(file.path.lastIndexOf(path.sep) + 1);
      let escapedFilename = filename.replace(/\./g, "\\.");
      let pattern = `(//# sourceMappingURL=)(.*)${escapedFilename}`;
      let contents = Buffer.from(file.contents).toString("utf-8");
      contents = contents.replace(new RegExp(pattern), `$1${filename}`);
      await fse.writeFile(file.path, contents);
    } else if (file.path.endsWith(".map")) {
      // remove route: prefix from source filenames so breakpoints work
      let contents = Buffer.from(file.contents).toString("utf-8");
      contents = contents.replace(/"route:/gm, '"');
      await fse.writeFile(file.path, contents);
    }
  }
}

/**
 * Topological sort: For each node, all of its (recursive) dependencies come
 * before it.
 * @see https://en.wikipedia.org/wiki/Topological_sorting
 */
function topologicalSort(
  graph: Record<string, string[]>,
  opts: Partial<{ filterEdges(edge: string): boolean }> = {}
) {
  let filter = opts.filterEdges || (() => true);
  let visited: string[] = [];
  let chain = new Set();
  let nodes = Object.keys(graph);
  nodes.forEach(visit);

  function visit(n: string) {
    if (visited.includes(n)) return;
    if (chain.has(n)) throw Error(`Cycle detected: ${[...chain].join(" -> ")}`);

    chain.add(n);
    for (let edge of graph[n]) {
      if (filter(edge)) {
        visit(edge);
      }
    }
    chain.delete(n);
    visited.push(n);
  }
  return visited;
}
