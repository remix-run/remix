import * as esbuild from "esbuild";
import * as path from "path";

import type { BuildOptions } from "../build";
import { getFileHash } from "../compiler/crypto";
import type { RemixConfig } from "../config";
import { loaders } from "./loaders";

const routeExportsCache: {
  [routeId: string]: { hash: string; exports: string[] };
} = Object.create(null);

export async function getRouteExportsCached(
  config: RemixConfig,
  options: BuildOptions,
  routeId: string
): Promise<string[]> {
  let file = path.resolve(
    config.appDirectory,
    config.routeManifest[routeId].moduleFile
  );
  let hash = await getFileHash(file);
  let cached = routeExportsCache[routeId];

  if (!cached || cached.hash !== hash) {
    let exports = await getRouteExports(config, options, routeId);
    cached = routeExportsCache[routeId] = { hash, exports };
  }

  return cached.exports;
}

export async function getRouteExports(
  config: RemixConfig,
  options: BuildOptions,
  routeId: string
): Promise<string[]> {
  let result = await esbuild.build({
    entryPoints: [
      path.resolve(
        config.appDirectory,
        config.routeManifest[routeId].moduleFile
      )
    ],
    platform: "node",
    target: options.target,
    format: "esm",
    bundle: true,
    splitting: true,
    loader: loaders,
    publicPath: config.publicPath,
    metafile: true,
    outdir: ".",
    write: false
  });
  let metafile = result.metafile!;

  for (let key in metafile.outputs) {
    let output = metafile.outputs[key];
    if (output.entryPoint) {
      return output.exports;
    }
  }

  return [];
}
