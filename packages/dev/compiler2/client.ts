import path from "path";
import * as esbuild from "esbuild";

import type { BuildOptions } from "../build";
import type { RemixConfig } from "../config";
import invariant from "../invariant";
import { getRouteExportsCached } from "./routes";
import { getLoaderForFile } from "./loaders";

type Route = RemixConfig["routeManifest"][string];

/**
 * Names of route module exports that run in the browser.
 */
const browserRouteExports = [
  "ErrorBoundary",
  "default",
  "handle",
  "links",
  "meta"
];

/**
 * Uses shims to exclude server-only code from the client entry points when
 * building them for the browser.
 */
export function browserEntryPointsPlugin(
  config: RemixConfig,
  options: BuildOptions
): esbuild.Plugin {
  const namespace = "browser-entry-points";

  return {
    name: namespace,
    async setup(build) {
      let routesByFile: Map<string, Route> = Object.keys(
        config.routeManifest
      ).reduce((map, key) => {
        let route = config.routeManifest[key];
        let entryPoint = path.resolve(config.appDirectory, route.moduleFile);
        map.set(entryPoint, route);
        return map;
      }, new Map());

      build.onResolve({ filter: /\?browser$/ }, args => {
        return { path: args.path, namespace };
      });

      build.onLoad({ filter: /\?browser$/, namespace }, async args => {
        let file = args.path.replace(/\?browser$/, "");

        let proxyModule: string;
        if (file === config.entryClientFile) {
          proxyModule = `export * from ${JSON.stringify(file)};`;
        } else {
          let route = routesByFile.get(file);
          invariant(route, `Cannot get route by path: ${args.path}`);

          let exports = await getRouteExportsCached(config, options, route.id);
          let spec = exports
            .filter(ex => browserRouteExports.includes(ex))
            .join(", ");

          proxyModule = `export { ${spec} } from ${JSON.stringify(file)};`;
        }

        return {
          contents: proxyModule,
          loader: getLoaderForFile(file),
          resolveDir: path.dirname(file)
        };
      });
    }
  };
}
