import chokidar from "chokidar";
import debounce from "lodash.debounce";
import * as path from "path";

import type { RemixConfig } from "../config";
import { readConfig } from "../config";
import { type Manifest } from "../manifest";
import type { CompileOptions } from "./options";
import * as Compiler from "./compiler";
import * as Logger from "./logger";

function isEntryPoint(config: RemixConfig, file: string): boolean {
  let appFile = path.relative(config.appDirectory, file);
  let entryPoints = [
    config.entryClientFile,
    config.entryServerFile,
    ...Object.values(config.routes).map((route) => route.file),
  ];
  return entryPoints.includes(appFile);
}

export type WatchOptions = Partial<CompileOptions> & {
  reloadConfig?(root: string): Promise<RemixConfig>;
  onRebuildStart?(): void;
  onRebuildFinish?(durationMs: number, manifest?: Manifest): void;
  onFileCreated?(file: string): void;
  onFileChanged?(file: string): void;
  onFileDeleted?(file: string): void;
  onInitialBuild?(durationMs: number, manifest?: Manifest): void;
};

let safeCompile = async (
  compiler: Compiler.Type
): Promise<Manifest | undefined> => {
  let result = await compiler.compile();
  if (!result.ok) {
    // TODO handle errors
    return;
  }
  return result.value;
};

export async function watch(
  config: RemixConfig,
  {
    mode = "development",
    liveReloadPort,
    target = "node14",
    sourcemap = true,
    logger = Logger.create(),
    reloadConfig = readConfig,
    onRebuildStart,
    onRebuildFinish,
    onFileCreated,
    onFileChanged,
    onFileDeleted,
    onInitialBuild,
  }: WatchOptions = {}
): Promise<() => Promise<void>> {
  let options: CompileOptions = {
    mode,
    liveReloadPort,
    target,
    sourcemap,
    logger,
  };

  let start = Date.now();
  let compiler = await Compiler.create(config, options);

  // initial build
  let manifest = await safeCompile(compiler);
  onInitialBuild?.(Date.now() - start, manifest);

  let restart = debounce(async () => {
    onRebuildStart?.();
    let start = Date.now();
    compiler.dispose();

    try {
      config = await reloadConfig(config.rootDirectory);
    } catch (error: unknown) {
      // TODO
      return;
    }

    compiler = await Compiler.create(config, options);
    let manifest = await safeCompile(compiler);
    onRebuildFinish?.(Date.now() - start, manifest);
  }, 500);

  let rebuild = debounce(async () => {
    onRebuildStart?.();
    let start = Date.now();
    let manifest = await safeCompile(compiler);
    onRebuildFinish?.(Date.now() - start, manifest);
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
      onFileChanged?.(file);
      await rebuild();
    })
    .on("add", async (file) => {
      onFileCreated?.(file);

      try {
        config = await reloadConfig(config.rootDirectory);
      } catch (error: unknown) {
        // TODO
        return;
      }

      await (isEntryPoint(config, file) ? restart : rebuild)();
    })
    .on("unlink", async (file) => {
      onFileDeleted?.(file);
      await (isEntryPoint(config, file) ? restart : rebuild)();
    });

  return async () => {
    await watcher.close().catch(() => undefined);
    compiler.dispose();
  };
}
