import * as rollup from "rollup";

import type { CompilerMode } from "./createCompilerInputOptions";
import createCompilerInputOptions from "./createCompilerInputOptions";

export interface WatchOptions {
  mode: CompilerMode;
  outputDir: string;
  sourceDir: string;
}

export default async function watch(
  { mode = "development", outputDir, sourceDir }: Partial<WatchOptions> = {},
  callback: (event: rollup.RollupWatcherEvent) => void
) {
  let compilerOptions = createCompilerInputOptions({ mode, sourceDir });

  let watcher = rollup.watch({
    ...compilerOptions,
    watch: {
      skipWrite: outputDir == null
    }
  });

  watcher.on("event", callback);

  return () => {
    watcher.close();
  };
}
