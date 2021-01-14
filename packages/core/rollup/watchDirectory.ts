import { promises as fsp } from "fs";
import type { Plugin } from "rollup";
import chokidar from "chokidar";
import tmp from "tmp";

/**
 * This is a workaround for a bug in Rollup where this.addWatchFile does
 * not correctly listen for files that are added to a directory.
 * See https://github.com/rollup/rollup/issues/3704
 */
export default function watchDirectory({
  sourceDir
}: {
  sourceDir: string;
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
    name: "watch-directory",
    async buildStart() {
      if (!startedWatcher) {
        await startWatcher();
        startedWatcher = true;
      }

      this.addWatchFile(tmpfile.name);
    }
  };
}
