import * as path from "path";
import * as esbuild from "esbuild";
import debounce from "lodash.debounce";
import chokidar from "chokidar";

import type { BuildOptions } from "./build";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import { warnOnce } from "./compiler/warnings";
import type { AssetsManifest } from "./compiler/assets";
import { createAssetsManifest } from "./compiler/assets";
import type { AssetsManifestPromiseRef } from "./compiler/plugins/serverAssetsManifestPlugin";
import { writeFileSafe } from "./compiler/utils/fs";
import {
  createServerBuild,
  writeServerBuildResult,
} from "./compiler/compile-server";
import { createBrowserBuild } from "./compiler/compile-browser";

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

export async function build(
  config: RemixConfig,
  {
    mode = "production",
    target = "node14",
    sourcemap = false,
    onWarning = defaultWarningHandler,
    onBuildFailure = defaultBuildFailureHandler,
  }: Partial<BuildOptions> = {}
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

type WatchOptions = Partial<BuildOptions> & {
  onRebuildStart?(): void;
  onRebuildFinish?(): void;
  onFileCreated?(file: string): void;
  onFileChanged?(file: string): void;
  onFileDeleted?(file: string): void;
  onInitialBuild?(): void;
};

export async function watch(
  config: RemixConfig,
  {
    mode = "development",
    target = "node14",
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
      generateAssetsManifest(config, build.metafile!)
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

  config.watchPaths?.forEach((watchPath) => {
    toWatch.push(watchPath);
  });

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

async function buildEverything(
  config: RemixConfig,
  assetsManifestPromiseRef: AssetsManifestPromiseRef,
  options: BuildOptions & { incremental?: boolean }
): Promise<(esbuild.BuildResult | undefined)[]> {
  try {
    let browserBuildPromise = createBrowserBuild(config, options);
    let assetsManifestPromise = browserBuildPromise.then((build) =>
      generateAssetsManifest(config, build.metafile!)
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
    options.onBuildFailure?.(err as Error);
    return [undefined, undefined];
  }
}

async function generateAssetsManifest(
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

  return assetsManifest;
}
