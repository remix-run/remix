import * as path from "node:path";
import type * as esbuild from "esbuild";
import fse from "fs-extra";

import type { RemixConfig } from "../../config";

export async function write(
  config: RemixConfig,
  outputFiles: esbuild.OutputFile[]
) {
  await fse.ensureDir(path.dirname(config.assetsBuildDirectory));

  for (let file of outputFiles) {
    await fse.ensureDir(path.dirname(file.path));
    await fse.writeFile(file.path, file.contents);
  }
}
