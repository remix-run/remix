import fs from "fs";
import { builtinModules } from "module";
import { isAbsolute } from "path";
import type { Plugin } from "esbuild";
import { CachedInputFileSystem, ResolverFactory } from "enhanced-resolve";

import {
  serverBuildVirtualModule,
  assetsManifestVirtualModule,
} from "../virtualModules";
import { createMatchPath } from "../utils/tsconfig";
import { loaders } from "../loaders";

/**
 * A plugin responsible for resolving bare module ids based on server target.
 * This includes externalizing for node based plaforms, and bundling for single file
 * environments such as cloudflare.
 */
export function browserBareModulesPlugin(): Plugin {
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
        // If it's not a bare module ID let esbuild handle it
        if (!isBareModuleId(resolvePath(path))) {
          return undefined;
        }

        let packageName = getNpmPackageName(path);
        // Let esbuild handle bundling the virtual modules, css,
        // and error cases for node built in modules
        if (
          path === serverBuildVirtualModule.id ||
          path === assetsManifestVirtualModule.id ||
          path.endsWith(".css") ||
          isNodeBuiltIn(packageName)
        ) {
          return undefined;
        }

        let resolvedPath = await new Promise<string>((resolve, reject) => {
          resolver.resolve({}, resolveDir, path, {}, (error, resolvedPath) => {
            if (error || !resolvedPath) return resolve(path);
            resolve(resolvedPath);
          });
        });

        return {
          path: resolvedPath,
          sideEffects: false,
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

function isBareModuleId(id: string): boolean {
  return !id.startsWith("node:") && !id.startsWith(".") && !isAbsolute(id);
}
