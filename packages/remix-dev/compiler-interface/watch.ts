import path from "path";
import chokidar from "chokidar";

import type {
  BrowserCompiler,
  CreateCompiler,
  ServerCompiler,
} from "./compiler";
import { dispose } from "./compiler";
import { build } from "./build";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";

// TODO error handling for if browser/server builds fail (e.g. syntax error)
// on___Error callback
// preserve watcher for common cases, throw for exotic errors

const reloadConfig = async (config: RemixConfig): Promise<RemixConfig> => {
  try {
    return readConfig(config.rootDirectory);
  } catch (error) {
    // onBuildFailure(error as Error);
    console.error(error);
    throw error;
  }
};

export const watch = async (
  config: RemixConfig,
  createCompiler: {
    browser: CreateCompiler<BrowserCompiler>;
    server: CreateCompiler<ServerCompiler>;
  },
  callbacks: {
    onInitialBuild?: () => void;
    onRebuildStart?: () => void;
    onRebuildFinish?: (durationMs: number) => void;
    onFileCreated?: (file: string) => void;
    onFileChanged?: (file: string) => void;
    onFileDeleted?: (file: string) => void;
  } = {}
): Promise<() => Promise<void>> => {
  let compiler = {
    browser: createCompiler.browser(config),
    server: createCompiler.server(config),
  };

  // initial build
  await build(config, compiler);
  callbacks.onInitialBuild?.();

  // TODO debounce
  let restart = async () => {
    callbacks.onRebuildStart?.();
    let start = Date.now();
    dispose(compiler);

    config = await reloadConfig(config);
    compiler = {
      browser: createCompiler.browser(config),
      server: createCompiler.server(config),
    };
    await build(config, compiler);
    callbacks.onRebuildFinish?.(Date.now() - start);
  };

  // TODO debounce
  let rebuild = async () => {
    callbacks.onRebuildStart?.();
    let start = Date.now();
    await build(config, compiler);
    callbacks.onRebuildFinish?.(Date.now() - start);
  };

  // watch files
  let toWatch = [config.appDirectory];
  if (config.serverEntryPoint) {
    toWatch.push(config.serverEntryPoint);
  }
  config.watchPaths.forEach((watchPath) => toWatch.push(watchPath));

  // what if route modules are not on filesystem?
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
      callbacks.onFileChanged?.(file);
      await rebuild();
    })
    .on("add", async (file) => {
      callbacks.onFileCreated?.(file);
      config = await reloadConfig(config);
      if (isEntryPoint(config, file)) {
        await restart();
      } else {
        await rebuild();
      }
    })
    .on("unlink", async (file) => {
      callbacks.onFileDeleted?.(file);
      if (isEntryPoint(config, file)) {
        await restart();
      } else {
        await rebuild();
      }
    });

  return async () => {
    await watcher.close().catch(() => undefined);
    dispose(compiler);
  };
};

function isEntryPoint(config: RemixConfig, file: string): boolean {
  let appFile = path.relative(config.appDirectory, file);
  let entryPoints = [
    config.entryClientFile,
    config.entryServerFile,
    ...Object.values(config.routes).map((route) => route.file),
  ];
  return entryPoints.includes(appFile);
}
