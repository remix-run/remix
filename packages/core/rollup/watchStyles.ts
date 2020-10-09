import { promises as fsp } from "fs";
import path from "path";
import type { Plugin } from "rollup";
import chokidar from "chokidar";
import tmp from "tmp";

import { isStylesFilename } from "../routes";
import { loadStyles } from "./styles";

/**
 * Rollup plugin that watches the given `sourceDir` for changes and outputs CSS
 * files in development.
 */
export default function watchStyles({
  sourceDir
}: {
  sourceDir: string;
}): Plugin {
  let tmpfile = tmp.fileSync();
  let startedWatcher = false;

  let files: string[] = [];
  let cache: { [id: string]: string } = {};

  function startWatcher() {
    return new Promise((accept, reject) => {
      chokidar
        .watch(sourceDir, {
          ignored: /node_modules/,
          followSymlinks: false
        })
        .on("add", handleAdd)
        .on("change", handleChange)
        .on("unlink", handleUnlink)
        .on("ready", accept)
        .on("error", reject);
    });
  }

  async function triggerRebuild() {
    let now = new Date();
    await fsp.utimes(tmpfile.name, now, now);
  }

  function handleAdd(file: string) {
    if (!files.includes(file) && isStylesFilename(path.basename(file))) {
      files.push(file);

      if (startedWatcher) {
        console.log(`Added file ${file}`);
        triggerRebuild();
      }
    }
  }

  function handleChange(file: string) {
    console.log(`Changed file ${file}`);
    delete cache[file];
    triggerRebuild();
  }

  function handleUnlink(file: string) {
    console.log(`Deleted ${file}`);
    delete cache[file];
    triggerRebuild();
  }

  return {
    name: "watch-styles",
    async buildStart() {
      if (!startedWatcher) {
        await startWatcher();
        startedWatcher = true;
      }

      this.addWatchFile(tmpfile.name);
    },
    async generateBundle() {
      for (let file of files) {
        let name = path.relative(
          sourceDir,
          path.join(
            path.dirname(file),
            path.basename(file, path.extname(file)) + ".css"
          )
        );

        // Use the cached version to speed things up. This will make a huge
        // difference when there are lots of files.
        let source = cache[file];
        if (source == null) {
          source = await loadStyles(file);
          cache[file] = source;
        }

        this.emitFile({ type: "asset", name, source });
      }
    }
  };
}
