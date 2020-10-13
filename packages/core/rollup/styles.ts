import { promises as fsp } from "fs";
import path from "path";
import type { Plugin } from "rollup";

import { isStylesFilename } from "../routes";

export function loadStyles(file: string): Promise<string> {
  // TODO: Transform using PostCSS based on file extension.
  return fsp.readFile(file, "utf-8");
}

/**
 * Rollup plugin that scans the given `sourceDir` and outputs CSS assets in
 * production.
 */
export default function styles({ sourceDir }: { sourceDir: string }): Plugin {
  let files: string[] = [];

  return {
    name: "styles",
    async buildStart() {
      let sourceFiles = await readdir(sourceDir, { recursive: true });
      for (let file of sourceFiles) {
        if (isStylesFilename(path.basename(file))) {
          files.push(file);
        }
      }
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

        let source = await loadStyles(file);

        this.emitFile({ type: "asset", name, source });
      }
    }
  };
}

async function readdir(
  dir: string,
  { recursive = false }: { recursive?: boolean } = {},
  files: string[] = []
): Promise<string[]> {
  for (let filename of await fsp.readdir(dir)) {
    let file = path.join(dir, filename);
    let stat = await fsp.lstat(file);

    if (stat.isFile()) {
      files.push(file);
    } else if (stat.isDirectory() && recursive) {
      await readdir(file, { recursive }, files);
    }
  }

  return files;
}
