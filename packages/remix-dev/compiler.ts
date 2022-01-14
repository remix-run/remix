import * as fsp from "fs/promises";
import * as path from "path";
import { builtinModules as nodeBuiltins } from "module";
import * as esbuild from "esbuild";
import debounce from "lodash.debounce";
import chokidar from "chokidar";

import { BuildMode, BuildTarget } from "./build";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import { warnOnce } from "./warnings";
import { createAssetsManifest } from "./compiler/assets";
import { getAppDependencies } from "./compiler/dependencies";
import { loaders } from "./compiler/loaders";
import { browserRouteModulesPlugin } from "./compiler/plugins/browserRouteModulesPlugin";
import { emptyModulesPlugin } from "./compiler/plugins/emptyModulesPlugin";
import { excludeRemixServerModulesPlugin } from "./compiler/plugins/excludeRemixServerModulesPlugin";
import { mdxPlugin } from "./compiler/plugins/mdx";
import { serverAssetsPlugin } from "./compiler/plugins/serverAssetsPlugin";
import type { ClientManifestPromiseRef } from "./compiler/plugins/serverAssetsPlugin";
import { serverBareModulesPlugin } from "./compiler/plugins/serverBareModulesPlugin";
import { serverEntryModulesPlugin } from "./compiler/plugins/serverEntryModulesPlugin";
import { serverRouteModulesPlugin } from "./compiler/plugins/serverRouteModulesPlugin";
import { writeFileSafe } from "./compiler/utils/fs";
import type { AssetsManifest } from "@remix-run/server-runtime/entry";

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
        color: true
      });
      console.warn(...messages);
    }

    if (failure.errors) {
      let messages = esbuild.formatMessagesSync(failure.errors, {
        kind: "error",
        color: true
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
    onBuildFailure = defaultBuildFailureHandler
  }: BuildOptions = {}
): Promise<void> {
  let ref: ClientManifestPromiseRef = {};

  await buildEverything(config, ref, {
    mode,
    target,
    sourcemap,
    onWarning,
    onBuildFailure
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
    onInitialBuild
  }: WatchOptions = {}
): Promise<() => Promise<void>> {
  let options = {
    mode,
    target,
    sourcemap,
    onBuildFailure,
    onWarning,
    incremental: true
  };
  let ref: ClientManifestPromiseRef = {};
  let [browserBuild, serverBuild] = await buildEverything(config, ref, options);

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
    let builders = await buildEverything(config, ref, options);
    if (onRebuildFinish) onRebuildFinish();
    browserBuild = builders[0];
    serverBuild = builders[1];
  }, 500);

  let rebuildEverything = debounce(async () => {
    if (onRebuildStart) onRebuildStart();

    if (!browserBuild?.rebuild || !serverBuild?.rebuild) {
      disposeBuilders();

      try {
        [browserBuild, serverBuild] = await buildEverything(
          config,
          ref,
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
    let clientBuildPromise = browserBuild
      .rebuild()
      .then(build => generateManifests(config, build.metafile!));
    ref.current = clientBuildPromise;

    await Promise.all([clientBuildPromise, serverBuild.rebuild()]).catch(
      err => {
        disposeBuilders();
        onBuildFailure(err);
      }
    );
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
    .on("unlink", async file => {
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

async function buildEverything(
  config: RemixConfig,
  clientManifestPromiseRef: ClientManifestPromiseRef,
  options: Required<BuildOptions> & { incremental?: boolean }
): Promise<(esbuild.BuildResult | undefined)[]> {
  // TODO:
  // When building for node, we build both the browser and server builds in
  // parallel and emit the asset manifest as a separate file in the output
  // directory.
  // When building for Cloudflare Workers, we need to run the browser and server
  // builds serially so we can inline the asset manifest into the server build
  // in a single JavaScript file.

  try {
    let browserBuildPromise = createBrowserBuild(config, options);
    let manifestPromise = browserBuildPromise.then(build => {
      return generateManifests(config, build.metafile!);
    });
    clientManifestPromiseRef.current = manifestPromise;
    let serverBuildPromise = createServerBuild(
      config,
      options,
      clientManifestPromiseRef
    );

    return await Promise.all([
      manifestPromise.then(() => browserBuildPromise),
      serverBuildPromise
    ]);
  } catch (err) {
    options.onBuildFailure(err as Error);
    return [undefined, undefined];
  }
}

async function createBrowserBuild(
  config: RemixConfig,
  options: BuildOptions & { incremental?: boolean }
): Promise<esbuild.BuildResult> {
  // For the browser build, exclude node built-ins that don't have a
  // browser-safe alternative installed in node_modules. Nothing should
  // *actually* be external in the browser build (we want to bundle all deps) so
  // this is really just making sure we don't accidentally have any dependencies
  // on node built-ins in browser bundles.
  let dependencies = Object.keys(await getAppDependencies(config));
  let externals = nodeBuiltins.filter(mod => !dependencies.includes(mod));
  let fakeBuiltins = nodeBuiltins.filter(mod => dependencies.includes(mod));

  if (fakeBuiltins.length > 0) {
    throw new Error(
      `It appears you're using a module that is built in to node, but you installed it as a dependency which could cause problems. Please remove ${fakeBuiltins.join(
        ", "
      )} before continuing.`
    );
  }

  let entryPoints: esbuild.BuildOptions["entryPoints"] = {
    "entry.client": path.resolve(config.appDirectory, config.entryClientFile)
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
    minify: options.mode === BuildMode.Production,
    entryNames: "[dir]/[name]-[hash]",
    chunkNames: "_shared/[name]-[hash]",
    assetNames: "_assets/[name]-[hash]",
    publicPath: config.publicPath,
    define: {
      "process.env.NODE_ENV": JSON.stringify(options.mode)
    },
    plugins: [
      mdxPlugin(config),
      browserRouteModulesPlugin(config, /\?browser$/),
      emptyModulesPlugin(config, /\.server(\.[jt]sx?)?$/),
      excludeRemixServerModulesPlugin()
    ]
  });
}

async function createServerBuild(
  config: RemixConfig,
  options: Required<BuildOptions> & { incremental?: boolean },
  clientManifestPromiseRef: ClientManifestPromiseRef
): Promise<esbuild.BuildResult> {
  let dependencies = await getAppDependencies(config);

  let stdin: esbuild.StdinOptions | undefined;
  let entryPoints: string[] | undefined;

  if (config.customServer) {
    entryPoints = [config.customServer];
  } else {
    let contents = `export * from "@remix-run/server-build";`;

    switch (config.serverBuildTarget) {
      case "arc":
        contents = `import { createRequestHandler } from "@remix-run/architect";
import * as build from "@remix-run/server-build";
export const handler = createRequestHandler({ build, mode: process.env.NODE_ENV });`;
        break;
      case "cloudflare-pages":
        contents = `import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";
import * as build from "@remix-run/server-build";
const handleRequest = createPagesFunctionHandler({ build });
export function onRequest(context) {
  return handleRequest(context);
}`;
        break;
      case "cloudflare-workers":
        contents = `import { createEventHandler } from "@remix-run/cloudflare-workers";
import * as build from "@remix-run/server-build";
addEventListener("fetch", createEventHandler({ build, mode: process.env.NODE_ENV }));`;
        break;
      case "deno":
        contents = ``;
        break;
      case "netlify":
        contents = `import { createRequestHandler } from "@remix-run/netlify";
import * as build from "@remix-run/server-build";
export const handler = createRequestHandler({ build, mode: process.env.NODE_ENV });`;
        break;
      case "vercel":
        contents = `import { createRequestHandler } from "@remix-run/vercel";
import * as build from "@remix-run/server-build";
export default createRequestHandler({ build, mode: process.env.NODE_ENV });`;
        break;
    }

    stdin = {
      contents,
      loader: "js"
    };
  }

  return esbuild
    .build({
      stdin,
      entryPoints,
      outfile: config.serverBuildPath,
      write: false,
      platform: config.serverPlatform,
      format: config.serverModuleFormat,
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
        "process.env.NODE_ENV": JSON.stringify(options.mode)
      },
      plugins: [
        mdxPlugin(config),
        emptyModulesPlugin(config, /\.client\.[tj]sx?$/),
        serverRouteModulesPlugin(config),
        serverEntryModulesPlugin(config),
        serverAssetsPlugin(clientManifestPromiseRef),
        serverBareModulesPlugin(config, dependencies)
      ]
    })
    .then(async buildResult => {
      await fsp
        .mkdir(path.dirname(config.serverBuildPath), { recursive: true })
        .catch(() => {});

      await Promise.all(
        buildResult.outputFiles.map(async file => {
          console.log(file.path);
          if (file.path !== config.serverBuildPath) {
            return;
          }
          await fsp.writeFile(file.path, file.contents);
        })
      );
      return buildResult;
    });
}

async function generateManifests(
  config: RemixConfig,
  metafile: esbuild.Metafile
): Promise<AssetsManifest> {
  let assetsManifest = await createAssetsManifest(config, metafile);

  let filename = `manifest-${assetsManifest.version.toUpperCase()}.js`;
  assetsManifest.url = config.publicPath + filename;

  await writeFileSafe(
    path.join(config.assetsBuildDirectory, filename),
    `window.__remixManifest=${JSON.stringify(assetsManifest)};`
  );

  return assetsManifest as AssetsManifest;
}
