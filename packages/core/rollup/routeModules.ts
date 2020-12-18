import type { Plugin } from "rollup";

import { BuildTarget } from "../build";

interface RollupObjectInput {
  [inputAlias: string]: string;
}

export interface RouteModuleFiles {
  [routeId: string]: string;
}

/**
 * Adds entry modules for all routes in the route manifest.
 */
export default function routeModules({
  routeModuleFiles,
  target
}: {
  routeModuleFiles: RouteModuleFiles;
  target: BuildTarget;
}): Plugin {
  let browserProxy = "?route-module-browser-proxy";

  return {
    name: "route-modules",
    options(options) {
      if (!options.input) {
        options.input = {};
      } else if (typeof options.input !== "object") {
        throw new Error(`routeModules plugin needs an object for input`);
      }

      let input = options.input as RollupObjectInput;

      for (let routeId in routeModuleFiles) {
        let file = routeModuleFiles[routeId];
        input[routeId] =
          file + (target === BuildTarget.Browser ? browserProxy : "");
      }

      return options;
    },
    resolveId(id, importer) {
      if (
        importer?.endsWith(browserProxy) &&
        importer.slice(0, -browserProxy.length) === id
      ) {
        // Use synthetic named exports on route modules when they are imported
        // from the browser proxy module. Since `default` (the component) is the
        // only required export, all others default to `undefined`.
        return { id, syntheticNamedExports: true };
      }

      if (id.endsWith(browserProxy)) return id;

      return null;
    },
    load(id) {
      if (id.endsWith(browserProxy)) {
        let file = id.slice(0, -browserProxy.length);

        // Create a proxy module that exports only the methods we want to be
        // available in the browser. All the rest will be tree-shaken out so we
        // don't end up with server-only code (and its dependencies) in the
        // browser bundles.
        return `export { default, meta } from ${JSON.stringify(file)}`;
      }

      return null;
    }
  };
}
