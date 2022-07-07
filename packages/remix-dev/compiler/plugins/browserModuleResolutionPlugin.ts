import fs from "fs";
import { builtinModules } from "module";
import type { Plugin } from "esbuild";
import { CachedInputFileSystem, ResolverFactory } from "enhanced-resolve";

import { createMatchPath } from "../utils/tsconfig";
import { loaders } from "../loaders";
import type { RemixConfig } from "../../config";

/**
 * A plugin responsible for resolving modules for the browser build.
 * This includes marking everything as side-effect false unless
 * explicitly marked as side-effect true.
 */
export function browserModuleResolutionPlugin(
  remixConfig: RemixConfig
): Plugin {
  // Resolve paths according to tsconfig paths property
  let matchPath = createMatchPath();
  function resolvePath(id: string) {
    if (!matchPath) {
      return id;
    }
    return (
      matchPath(id, undefined, undefined, [".ts", ".tsx", ".js", ".jsx"]) || id
    );
  }

  return {
    name: "browser-bare-modules",
    setup(build) {
      let resolver = ResolverFactory.createResolver({
        fileSystem: new CachedInputFileSystem(fs, 4000),
        extensions: Object.keys(loaders),
        mainFields: ["browser", "module", "main"],
        conditionNames: ["browser", "import", "module", "default", "main"],
      });

      build.onResolve({ filter: /.*/ }, async ({ resolveDir, path }) => {
        // Resolve aliases such as `~/`
        let finalPath = resolvePath(path);

        let packageName = getNpmPackageName(path);
        // Let esbuild handle error cases for node built in modules
        if (isNodeBuiltIn(packageName)) {
          return undefined;
        }

        // Attempt to resolve everything else to it's source
        finalPath = await new Promise<string>((resolve, reject) => {
          resolver.resolve(
            {},
            resolveDir,
            finalPath,
            {},
            (error, resolvedPath) => {
              if (error || !resolvedPath) return resolve(finalPath);
              resolve(resolvedPath);
            }
          );
        });

        let sideEffects = remixConfig.clientDependenciesWithSideEffects.some(
          (pattern) =>
            typeof pattern === "string" ? path === pattern : pattern.test(path)
        );

        // Mark as side-effect free to prevent esbuild from bundling it
        // if it's only used in a server context
        return {
          path: finalPath,
          sideEffects,
        };
      });
    },
  };
}

function isNodeBuiltIn(packageName: string) {
  return builtinModules.includes(packageName);
}

function getNpmPackageName(id: string): string {
  let split = id.split("/");
  let packageName = split[0];
  if (packageName.startsWith("@")) packageName += `/${split[1]}`;
  return packageName;
}
