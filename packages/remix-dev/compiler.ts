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
import { warnOnce } from "./warnings";
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
import type {
  CssModuleClassMap,
  CssModulesResults,
  CssModulesBuildPromiseRef,
} from "./compiler/plugins/cssModules";
import {
  cssModulesPlugin,
  cssModulesFakerPlugin,
  getCssModulesFilePath,
} from "./compiler/plugins/cssModules";
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
  warnOnce(false, message, key);
}

function defaultBuildFailureHandler(failure: Error | esbuild.BuildFailure) {
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
  let cssModulesBuildPromiseRef: CssModulesBuildPromiseRef = {};

  await buildEverything(
    config,
    assetsManifestPromiseRef,
    cssModulesBuildPromiseRef,
    {
      mode,
      target,
      sourcemap,
      onWarning,
      onBuildFailure,
    }
  );
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
  let cssModulesBuildPromiseRef: CssModulesBuildPromiseRef = {};
  let [cssModulesBuild, browserBuild, serverBuild] = await buildEverything(
    config,
    assetsManifestPromiseRef,
    cssModulesBuildPromiseRef,
    options
  );

  let initialBuildComplete =
    !!cssModulesBuild && !!browserBuild && !!serverBuild;
  if (initialBuildComplete) {
    onInitialBuild?.();
  }

  function disposeBuilders() {
    cssModulesBuild?.rebuild?.dispose();
    browserBuild?.rebuild?.dispose();
    serverBuild?.rebuild?.dispose();
    cssModulesBuild = undefined;
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
      cssModulesBuildPromiseRef,
      options
    );
    if (onRebuildFinish) onRebuildFinish();

    [cssModulesBuild, browserBuild, serverBuild] = builders;
  }, 500);

  let rebuildEverything = debounce(async () => {
    if (onRebuildStart) onRebuildStart();

    if (
      !cssModulesBuild?.rebuild ||
      !browserBuild?.rebuild ||
      !serverBuild?.rebuild
    ) {
      disposeBuilders();

      try {
        [cssModulesBuild, browserBuild, serverBuild] = await buildEverything(
          config,
          assetsManifestPromiseRef,
          cssModulesBuildPromiseRef,
          options
        );

        if (!initialBuildComplete) {
          initialBuildComplete =
            !!cssModulesBuild && !!browserBuild && !!serverBuild;
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
    let cssModulesBuildPromise = cssModulesBuild.rebuild();
    let browserBuildPromise = browserBuild.rebuild();
    let assetsManifestPromise = browserBuildPromise.then((build) =>
      generateAssetsManifest(config, build.metafile!, cssModulesBuildPromiseRef)
    );

    // Assign the assetsManifestPromise to a ref so the server build can await
    // it when loading the @remix-run/dev/assets-manifest virtual module.
    assetsManifestPromiseRef.current = assetsManifestPromise;
    cssModulesBuildPromiseRef.current = cssModulesBuildPromise;

    await Promise.all([
      cssModulesBuildPromise,
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

interface BrowserBuild extends esbuild.BuildResult {}
interface ServerBuild extends esbuild.BuildResult {}

interface BuildInvalidate {
  (): Promise<CssModulesBuildIncremental>;
  dispose(): void;
}
export interface CssModulesBuild extends CssModulesResults {
  result: esbuild.BuildResult;
  rebuild?: BuildInvalidate;
}

interface CssModulesBuildIncremental extends CssModulesBuild {
  rebuild: BuildInvalidate;
}

async function buildEverything(
  config: RemixConfig,
  assetsManifestPromiseRef: AssetsManifestPromiseRef,
  cssModulesBuildPromiseRef: CssModulesBuildPromiseRef,
  options: Required<BuildOptions> & { incremental?: boolean }
): Promise<
  [
    CssModulesBuild | undefined,
    BrowserBuild | undefined,
    ServerBuild | undefined
  ]
> {
  try {
    let cssModulesPromise = createCssModulesBuild(
      config,
      options,
      assetsManifestPromiseRef
    );

    let browserBuildPromise = createBrowserBuild(
      config,
      cssModulesBuildPromiseRef,
      options
    );
    let assetsManifestPromise = browserBuildPromise.then((build) =>
      generateAssetsManifest(config, build.metafile!, cssModulesBuildPromiseRef)
    );

    // Assign the assetsManifestPromise to a ref so the server build can await
    // it when loading the @remix-run/dev/assets-manifest virtual module.
    assetsManifestPromiseRef.current = assetsManifestPromise;

    // Assign the cssModulesBuildPromiseRef to a ref so both server and client builds
    // can await it when loading the @remix-run/dev/css-modules virtual module.
    cssModulesBuildPromiseRef.current = cssModulesPromise;

    let serverBuildPromise = createServerBuild(
      config,
      assetsManifestPromiseRef,
      cssModulesBuildPromiseRef,
      options
    );

    return await Promise.all([
      cssModulesPromise,
      assetsManifestPromise.then(() => browserBuildPromise),
      serverBuildPromise,
    ]);
  } catch (err) {
    options.onBuildFailure(err as Error);
    return [undefined, undefined, undefined];
  }
}

async function createBrowserBuild(
  config: RemixConfig,
  cssModulesBuildPromiseRef: CssModulesBuildPromiseRef,
  options: BuildOptions & { incremental?: boolean }
): Promise<esbuild.BuildResult> {
  // For the browser build, exclude node built-ins that don't have a
  // browser-safe alternative installed in node_modules. Nothing should
  // *actually* be external in the browser build (we want to bundle all deps) so
  // this is really just making sure we don't accidentally have any dependencies
  // on node built-ins in browser bundles.
  let dependencies = Object.keys(await getAppDependencies(config));
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

  return esbuild.build({
    entryPoints,
    outdir: config.assetsBuildDirectory,
    platform: "browser",
    format: "esm",
    external: externals,
    inject: [reactShim],
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
    plugins: [
      cssModulesFakerPlugin(config, cssModulesBuildPromiseRef),
      mdxPlugin(config),
      browserRouteModulesPlugin(config, /\?browser$/),
      emptyModulesPlugin(config, /\.server(\.[jt]sx?)?$/),
      NodeModulesPolyfillPlugin(),
    ],
  });
}

async function createServerBuild(
  config: RemixConfig,
  assetsManifestPromiseRef: AssetsManifestPromiseRef,
  cssModulesBuildPromiseRef: CssModulesBuildPromiseRef,
  options: Required<BuildOptions> & { incremental?: boolean }
): Promise<esbuild.BuildResult> {
  let dependencies = await getAppDependencies(config);

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

  let plugins: esbuild.Plugin[] = [
    cssModulesFakerPlugin(config, cssModulesBuildPromiseRef),
    mdxPlugin(config),
    emptyModulesPlugin(config, /\.client(\.[jt]sx?)?$/),
    serverRouteModulesPlugin(config),
    serverEntryModulePlugin(config),
    serverAssetsManifestPlugin(assetsManifestPromiseRef),
    serverBareModulesPlugin(config, dependencies),
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
      platform: config.serverPlatform,
      format: config.serverModuleFormat,
      treeShaking: true,
      minify:
        options.mode === BuildMode.Production &&
        !!config.serverBuildTarget &&
        ["cloudflare-workers", "cloudflare-pages"].includes(
          config.serverBuildTarget
        ),
      mainFields:
        config.serverModuleFormat === "esm"
          ? ["module", "main"]
          : ["main", "module"],
      target: options.target,
      inject: [reactShim],
      loader: loaders,
      bundle: true,
      logLevel: "silent",
      incremental: options.incremental,
      sourcemap: options.sourcemap ? "inline" : false,
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

async function createCssModulesBuild(
  config: RemixConfig,
  options: Required<BuildOptions> & { incremental?: boolean },
  assetsManifestPromiseRef: AssetsManifestPromiseRef
): Promise<CssModulesBuild> {
  // ... find all .module.css files
  // aggregate the contents, keep an object of the JSON
  // run the full build (we don't care about JS modules...)
  // output only a single file to public/build
  // return result to browser/server builds

  let cssModulesContent = "";
  let cssModulesJson: CssModuleClassMap = {};
  let cssModulesMap: Record<string, { css: string; json: CssModuleClassMap }> =
    {};
  function handleProcessedCss(
    filePath: string,
    css: string,
    json: CssModuleClassMap
  ) {
    cssModulesContent += css;
    cssModulesJson = { ...cssModulesJson, ...json };
    cssModulesMap = {
      ...cssModulesMap,
      [filePath]: {
        css,
        json,
      },
    };
  }

  // The rest of this is copied from the server build

  let dependencies = await getAppDependencies(config);

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

  let plugins: esbuild.Plugin[] = [
    mdxPlugin(config),
    cssModulesPlugin(config, handleProcessedCss),
    emptyModulesPlugin(config, /\.client(\.[jt]sx?)?$/),
    serverRouteModulesPlugin(config),
    serverEntryModulePlugin(config),
    serverAssetsManifestPlugin(assetsManifestPromiseRef),
    serverBareModulesPlugin(config, dependencies),
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
      platform: config.serverPlatform,
      format: config.serverModuleFormat,
      treeShaking: true,
      minify:
        options.mode === BuildMode.Production &&
        !!config.serverBuildTarget &&
        ["cloudflare-workers", "cloudflare-pages"].includes(
          config.serverBuildTarget
        ),
      mainFields:
        config.serverModuleFormat === "esm"
          ? ["module", "main"]
          : ["main", "module"],
      target: options.target,
      inject: [reactShim],
      loader: loaders,
      bundle: true,
      logLevel: "silent",
      incremental: options.incremental,
      sourcemap: options.sourcemap ? "inline" : false,
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
      return {
        result: build,
        rebuild: (() => {
          if (!options.incremental) {
            return undefined;
          }
          let builder = (async () => {
            // Clear CSS modules data before rebuild
            cssModulesContent = "";
            cssModulesMap = {};
            let result = await build.rebuild!();
            return {
              result,
              rebuild: builder,
              filePath: await getCssModulesFilePath(config, cssModulesContent),
              moduleMap: cssModulesMap,
            };
          }) as BuildInvalidate;
          // TODO: unsure about this, check back w/ esbuild docs to clarify what
          // dispose is doing and see if we need to clear any internal state
          builder.dispose = build.rebuild!.dispose;
          return builder;
        })(),
        filePath: await getCssModulesFilePath(config, cssModulesContent),
        moduleMap: cssModulesMap,
      };
    });
}

async function generateAssetsManifest(
  config: RemixConfig,
  metafile: esbuild.Metafile,
  cssModulesBuildPromiseRef: CssModulesBuildPromiseRef
): Promise<AssetsManifest> {
  let cssModulesResults = await cssModulesBuildPromiseRef.current;
  let assetsManifest = await createAssetsManifest(
    config,
    metafile,
    cssModulesResults
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
    if (file.path === config.serverBuildPath) {
      await fse.writeFile(file.path, file.contents);
      break;
    }
  }
}
