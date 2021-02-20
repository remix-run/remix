import { promises as fsp } from "fs";
import type { InputOptions, InputOption, Plugin } from "rollup";
import chokidar from "chokidar";
import tmp from "tmp";

/**
 * Enables setting the compiler's input dynamically via a hook function.
 */
export default function watchInput({
  sourceDir,
  getInput
}: {
  sourceDir: string;
  getInput: (options: InputOptions) => Promise<InputOption>;
}): Plugin {
  let tmpfile = tmp.fileSync();
  let startedWatcher = false;

  function startWatcher() {
    return new Promise((accept, reject) => {
      chokidar
        .watch(sourceDir, {
          ignoreInitial: true,
          ignored: /node_modules/,
          followSymlinks: false
        })
        .on("add", handleAdd)
        .on("ready", accept)
        .on("error", reject);
    });
  }

  async function triggerRebuild() {
    let now = new Date();
    await fsp.utimes(tmpfile.name, now, now);
  }

  function handleAdd() {
    triggerRebuild();
  }

  return {
    name: "watch-input",
    // The `options` hook is async, but Rollup's current typings do not use the
    // Promise<T> return type. Should probably file a Rollup bug.
    // @ts-ignore
    async options(opts: InputOptions) {
      let input = await getInput(opts);
      return { ...opts, input } as InputOptions;
    },
    async buildStart() {
      // This is a workaround for a bug in Rollup where this.addWatchFile does
      // not correctly listen for files that are added to a directory.
      // See https://github.com/rollup/rollup/issues/3704
      if (!startedWatcher) {
        await startWatcher();
        startedWatcher = true;
      }

      this.addWatchFile(tmpfile.name);
    }
  };
}
