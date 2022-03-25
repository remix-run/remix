import { builtinModules } from "module";
import { isAbsolute, relative } from "path";
import tsConfigPaths from 'tsconfig-paths';
import type { Plugin } from "esbuild";

import type { RemixConfig } from "../../config";
import {
  serverBuildVirtualModule,
  assetsManifestVirtualModule,
} from "../virtualModules";
import { loadTsConfig } from "../utils/tsconfig";

/**
 * A plugin responsible for resolving bare module ids based on server target.
 * This includes externalizing for node based plaforms, and bundling for single file
 * environments such as cloudflare.
 */
export function serverBareModulesPlugin(
  remixConfig: RemixConfig,
  dependencies: Record<string, string>,
  onWarning?: (warning: string, key: string) => void
): Plugin {
  let matchPath = createMatchPath();
  // Resolve paths according to tsconfig paths property
  function resolvePath(id: string) {
    if (!matchPath) {
      return id;
    }
    return matchPath(id, undefined, undefined, [".ts", ".tsx", ".js", ".jsx"]) || id;
  }

  return {
    name: "server-bare-modules",
    setup(build) {
      build.onResolve({ filter: /.*/ }, ({ importer, path }) => {
        // If it's not a bare module ID, bundle it.
        if (!isBareModuleId(resolvePath(path))) {
          return undefined;
        }

        // To prevent `import xxx from "remix"` from ending up in the bundle
        // we "bundle" remix but the other modules where the code lives.
        if (path === "remix") {
          return undefined;
        }

        // These are our virutal modules, always bundle them because there is no
        // "real" file on disk to externalize.
        if (
          path === serverBuildVirtualModule.id ||
          path === assetsManifestVirtualModule.id
        ) {
          return undefined;
        }

        // Always bundle CSS files so we get immutable fingerprinted asset URLs.
        if (path.endsWith(".css")) {
          return undefined;
        }

        let packageName = getNpmPackageName(path);

        // Warn if we can't find an import for a package.
        if (
          onWarning &&
          !isNodeBuiltIn(packageName) &&
          !/\bnode_modules\b/.test(importer) &&
          !builtinModules.includes(packageName) &&
          !dependencies[packageName]
        ) {
          onWarning(
            `The path "${path}" is imported in ` +
              `${relative(process.cwd(), importer)} but ` +
              `${packageName} is not listed in your package.json dependencies. ` +
              `Did you forget to install it?`,
            packageName
          );
        }

        switch (remixConfig.serverBuildTarget) {
          // Always bundle everything for cloudflare.
          case "cloudflare-pages":
          case "cloudflare-workers":
            return undefined;
        }

        for (let pattern of remixConfig.serverDependenciesToBundle) {
          // bundle it if the path matches the pattern
          if (
            typeof pattern === "string" ? path === pattern : pattern.test(path)
          ) {
            return undefined;
          }
        }

        // Externalize everything else if we've gotten here.
        return {
          path,
          external: true,
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

function createMatchPath() {
  let configLoaderResult = loadTsConfig();
  if (configLoaderResult.resultType === 'failed') {
    return undefined;
  }

  let matchPath = tsConfigPaths.createMatchPath(
    configLoaderResult.absoluteBaseUrl,
    configLoaderResult.paths,
    configLoaderResult.mainFields,
    configLoaderResult.addMatchAll
  );
  return matchPath;
}

function isBareModuleId(id: string): boolean {
  return (
    !id.startsWith("node:") &&
    !id.startsWith(".") &&
    !isAbsolute(id)
  );
}
