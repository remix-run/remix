import type { Plugin } from "esbuild";

import type { RemixConfig } from "../../config";
import { cssBuildVirtualModule } from "../virtualModules";

/**
 * Creates a virtual module called `@remix-run/dev/css-build` that imports all
 * browser build entry points so that any reachable CSS can be included in a
 * single file at the end of the build.
 */
export function cssEntryModulePlugin(config: RemixConfig): Plugin {
  let filter = cssBuildVirtualModule.filter;

  return {
    name: "css-entry-module",
    setup(build) {
      build.onResolve({ filter }, ({ path }) => {
        return {
          path,
          namespace: "css-entry-module",
        };
      });

      build.onLoad({ filter }, async () => {
        return {
          resolveDir: config.appDirectory,
          loader: "js",
          contents: [
            `export * as entryClient from ${JSON.stringify(
              `./${config.entryClientFile}`
            )};`,
            ...Object.keys(config.routes).map((key, index) => {
              let route = config.routes[key];
              return `export * as route${index} from ${JSON.stringify(
                `./${route.file}`
              )};`;
            }),
          ].join("\n"),
        };
      });
    },
  };
}
