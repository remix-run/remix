import path from "path";
import type { Plugin } from "esbuild";
import fse from "fs-extra";

const pluginName = "css-side-effects-plugin";
const namespace = `${pluginName}-ns`;
export const cssSideEffectSuffix = "?__remix_sideEffect__";
const cssSideEffectFilter = new RegExp(`\\.css\\?${cssSideEffectSuffix}$`);

export function isCssSideEffectPath(path: string): boolean {
  return cssSideEffectFilter.test(path);
}

const importRegExp = /(^|\n|;)(\s*import ['"].*?\.css)(['"])/gi;
const requireRegExp =
  /(^|\n|;|\)\s*{|else\s*{)(\s*require\(['"].*?\.css)(['"]\))/gi;

export function addSuffixToCssSideEffectImports(contents: string): string {
  return contents
    .replace(importRegExp, `$1$2${cssSideEffectSuffix}$3`)
    .replace(requireRegExp, `$1$2${cssSideEffectSuffix}$3`);
}

const loaderForExtension = {
  ".js": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".tsx": "tsx",
} as const;

const allJsFilesFilter = /.[jt]sx?$/;

export const cssSideEffectsPlugin = (options: {
  rootDirectory: string;
}): Plugin => {
  return {
    name: pluginName,
    setup: async (build) => {
      build.onLoad(
        { filter: allJsFilesFilter, namespace: "file" },
        async (args) => {
          let contents = await fse.readFile(args.path, "utf8");

          if (!contents.includes(".css")) {
            return null;
          }

          return {
            contents: addSuffixToCssSideEffectImports(contents),
            loader:
              loaderForExtension[
                path.extname(args.path) as keyof typeof loaderForExtension
              ],
          };
        }
      );

      build.onResolve(
        { filter: cssSideEffectFilter, namespace: "file" },
        async (args) => {
          let resolvedPath = (
            await build.resolve(args.path, {
              resolveDir: args.resolveDir,
              kind: args.kind,
            })
          ).path;

          return {
            path: path.relative(options.rootDirectory, resolvedPath),
            namespace: resolvedPath.endsWith(".css") ? namespace : undefined,
          };
        }
      );

      build.onLoad({ filter: /\.css$/, namespace }, async (args) => {
        let contents = await fse.readFile(args.path, "utf8");

        return {
          contents,
          loader: "css",
        };
      });
    },
  };
};
