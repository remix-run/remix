import { builtinModules } from "module";
import { isAbsolute, relative } from "path";

import type { Plugin } from "esbuild";

import { RemixConfig } from "../../config";

export function serverBareModulesPlugin(
  remixConfig: RemixConfig,
  dependencies: Record<string, string>,
  onWarning?: (warning: string, key: string) => void
): Plugin {
  return {
    name: "bare-modules",
    setup(build) {
      build.onResolve({ filter: /.*/ }, ({ importer, path }) => {
        if (
          !isBareModuleId(path) ||
          path === "remix" ||
          path === "@remix-run/server-entry" ||
          path === "@remix-run/assets"
        ) {
          return undefined;
        }

        if (path.endsWith(".css")) {
          return undefined;
        }

        let packageName = getNpmPackageName(path);

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
          case "cloudflare-pages":
          case "cloudflare-workers":
            return undefined;
          case "deno":
            if (isNodeBuiltIn(packageName)) {
              return {
                path: `https://deno.land/std/node/${path}.ts`,
                external: true,
                namespace: "external"
              };
            }

            return undefined;
        }

        return {
          path,
          external: true,
          namespace: "external"
        };
      });
    }
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
  return !id.startsWith(".") && !id.startsWith("~") && !isAbsolute(id);
}
