import * as path from "path";
import type esbuild from "esbuild";

import type { RemixConfig } from "../../config";
import { getRouteModuleExportsCached } from "../routes";
import invariant from "../../invariant";

type Route = RemixConfig["routes"][string];

const browserSafeRouteExports: { [name: string]: boolean } = {
  CatchBoundary: true,
  ErrorBoundary: true,
  default: true,
  handle: true,
  links: true,
  meta: true,
  unstable_shouldReload: true
};

export async function getBrowserSafeExportsForRoute(
  config: RemixConfig,
  routeId: string
): Promise<string[]> {
  const theExports = await getRouteModuleExportsCached(config, routeId);
  return theExports.filter(ex => !!browserSafeRouteExports[ex]);
}

export async function isResourceOnlyRoute(config: RemixConfig, routeId: string): Promise<boolean> {
  return (await getBrowserSafeExportsForRoute(config, routeId)).length === 0;
}

/**
 * This plugin loads route modules for the browser build, using module shims
 * that re-export only the route module exports that are safe for the browser.
 */
export function browserRouteModulesPlugin(
  config: RemixConfig,
  suffixMatcher: RegExp
): esbuild.Plugin {
  return {
    name: "browser-route-modules",
    async setup(build) {
      let routesByFile: Map<string, Route> = Object.keys(config.routes).reduce(
        (map, key) => {
          let route = config.routes[key];
          map.set(path.resolve(config.appDirectory, route.file), route);
          return map;
        },
        new Map()
      );

      build.onResolve({ filter: suffixMatcher }, args => {
        return {
          path: args.path,
          namespace: "browser-route-module"
        };
      });

      build.onLoad(
        { filter: suffixMatcher, namespace: "browser-route-module" },
        async args => {
          let theExports;
          let file = args.path.replace(suffixMatcher, "");
          let route = routesByFile.get(file);

          try {
            invariant(route, `Cannot get route by path: ${args.path}`);

            theExports = await getBrowserSafeExportsForRoute(config, route.id);
          } catch (error: any) {
            return {
              errors: [
                {
                  text: error.message,
                  pluginName: "browser-route-module"
                }
              ]
            };
          }

          // This should never hit, as we are filtering these out in createBrowserBuild
          // in compiler.ts. But it doesn't hurt to be defensive.

          // If it *does* for some reason, wrap it in an if instead of just calling invariant()
          // so we don't pay the Object.keys cost unless there's a problem.
          if (theExports.length === 0) {
            invariant(
              false,
              `Route at path ${file} does not have any browser-safe exports.\n` +
                `Browser-safe exports are: ${Object.keys(
                  browserSafeRouteExports
                )
                  // Let's not surface unstable_* stuff in error messages
                  .filter(n => !n.startsWith("unstable_"))
                  .join(", ")}`
            );
          }

          let exports = theExports.join(", ");
          let contents = `export { ${exports} } from ${JSON.stringify(file)}`;

          return {
            contents,
            resolveDir: path.dirname(file),
            loader: "js"
          };
        }
      );
    }
  };
}
