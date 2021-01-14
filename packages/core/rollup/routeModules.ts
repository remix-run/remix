import fs from "fs";
import path from "path";
import type { Plugin } from "rollup";

import { BuildTarget } from "../build";
import { getRemixConfig } from "./remixConfig";

/**
 * All file extensions we support for route modules.
 */
export const moduleExts = [".md", ".mdx", ".js", ".jsx", ".ts", ".tsx"];

export function isModuleFile(filename: string): boolean {
  return moduleExts.includes(path.extname(filename));
}

/**
 * A resolver/loader for route modules that does a few things:
 *
 * - when building for the browser, it excludes server-only code from the build
 * - when new route files are created in development (watch) mode, it creates
 *   an empty shim for the module so Rollup doesn't complain and the build
 *   doesn't break
 */
export default function routeModules({
  target
}: {
  target: BuildTarget;
}): Plugin {
  let magicProxy = "?route-module-proxy";

  return {
    name: "route-modules",
    async options(options) {
      let config = await getRemixConfig(options.plugins || []);
      let routeIds = Object.keys(config.routeManifest);

      let input = options.input;

      if (input && typeof input === "object" && !Array.isArray(input)) {
        for (let alias in input) {
          if (routeIds.includes(alias)) {
            input[alias] = input[alias] + magicProxy;
          }
        }
      }

      return options;
    },
    resolveId(id, importer) {
      if (id.endsWith(magicProxy)) {
        return id;
      }

      if (
        importer?.endsWith(magicProxy) &&
        importer.slice(0, -magicProxy.length) === id &&
        target === BuildTarget.Browser
      ) {
        // Use synthetic named exports on route modules when they are imported
        // from the browser proxy module. Since it explicitly names the exports
        // it wants, this prevents Rollup from complaining when they're not
        // there. `default` (the component) is the only required export, all
        // others default to `undefined`.
        return { id, syntheticNamedExports: true };
      }

      return null;
    },
    load(id) {
      if (id.endsWith(magicProxy)) {
        let source = id.slice(0, -magicProxy.length);

        if (fs.existsSync(source) && fs.statSync(source).size === 0) {
          this.addWatchFile(source);
          // If the source module is an empty file (probably because the file
          // was just created) default to an empty component. This prevents
          // errors in development (watch) mode when creating new route files.
          return `export default function () { throw new Error('Route "${source}" is empty, put a default export in there') }`;
        }

        if (target === BuildTarget.Browser) {
          // Create a proxy module that exports only the methods we want to be
          // available in the browser. All the rest will be tree-shaken out so
          // we don't end up with server-only code (and its dependencies) in the
          // browser bundles.
          return `export { default, meta, ErrorBoundary } from ${JSON.stringify(
            source
          )};`;
        }

        // Create a proxy module that transparently re-exports everything from
        // the original module.
        return (
          `export { default } from ${JSON.stringify(source)};\n` +
          `export * from ${JSON.stringify(source)};`
        );
      }

      return null;
    }
  };
}
