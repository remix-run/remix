import path from "path";

import type * as esbuild from "esbuild";

import { RemixConfig } from "../../config";

export function importMapPlugin(config: RemixConfig): esbuild.Plugin {
  return {
    name: "remix-import-map",
    async setup(build) {
      if (!config?.importMap?.imports) return;
      let imports = config.importMap.imports;

      if (config.bundleImportMap) {
        // @ts-ignore
        let { cache } = await import("esbuild-plugin-cache");

        let cachePlugin = cache({
          importmap: config.importMap,
        });

        await cachePlugin.setup(build);
      } else {
        build.onResolve({ filter: /.*/ }, params => {
          if (imports[params.path]) {
            return {
              path: imports[params.path],
              external: true
            };
          }
        });
      }
    }
  };
}
