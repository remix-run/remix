import * as path from "path";

import type { RemixConfig } from "../../config";

export function createUrl(publicPath: string, file: string): string {
  return publicPath + file.split(path.win32.sep).join("/");
}

export function resolveUrl(config: RemixConfig, outputPath: string): string {
  return createUrl(
    config.publicPath,
    path.relative(config.assetsBuildDirectory, path.resolve(outputPath))
  );
}
