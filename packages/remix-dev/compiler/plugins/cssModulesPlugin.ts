// Local fork of https://github.com/indooorsman/esbuild-css-modules-plugin
import path from "path";
import type { Plugin, PluginBuild } from "esbuild";

import type { CompileOptions } from "../options";

const pluginName = "css-modules-plugin";
const pluginNamespace = `${pluginName}-namespace`;
const buildingCssSuffix = `?${pluginName}-building`;
const builtCssSuffix = `?${pluginName}-built`;
const modulesCssRegExp = /\.module\.css$/;
const builtModulesCssRegExp = new RegExp(
  `.module.css${builtCssSuffix.replace("?", "\\?").replace(/-/g, "\\-")}$`,
  "i"
);

function getRootDir(build: PluginBuild): string {
  let { absWorkingDir } = build.initialOptions;
  let abs = absWorkingDir ? absWorkingDir : process.cwd();
  let rootDir = path.isAbsolute(abs) ? abs : path.resolve(process.cwd(), abs);
  return rootDir;
}

export const cssModulesPlugin = ({
  mode,
  appDirectory,
}: {
  mode: CompileOptions["mode"];
  appDirectory: string;
}): Plugin => {
  return {
    name: pluginName,
    setup: async (build: PluginBuild) => {
      let buildRoot = getRootDir(build);

      function getRelativePathFromBuildRoot(to: string): string {
        if (!path.isAbsolute(to)) {
          return to.startsWith(".") ? to : `.${path.sep}${to}`;
        }
        return `.${path.sep}${path.relative(buildRoot, to)}`;
      }

      // resolve xxx.module.css to xxx.module.css?css-modules-plugin-building
      build.onResolve(
        { filter: modulesCssRegExp, namespace: "file" },
        async (args) => {
          let { resolve } = build;
          let { resolveDir, path: p, pluginData = {} } = args;
          let { path: absPath } = await resolve(p, { resolveDir });
          let relativePath = getRelativePathFromBuildRoot(absPath);

          return {
            namespace: pluginNamespace,
            suffix: buildingCssSuffix,
            path: relativePath,
            external: false,
            pluginData: {
              ...pluginData,
              relativePathToBuildRoot: relativePath,
            },
            sideEffects: true,
            pluginName,
          };
        }
      );

      // load xxx.module.css?css-modules-plugin-building
      build.onLoad(
        { filter: modulesCssRegExp, namespace: pluginNamespace },
        async (args) => {
          let { path: fullPath, pluginData = {} } = args;

          let cssFileName = path.basename(fullPath); // e.g. xxx.module.css?css-modules-plugin-building
          let resolveDir = path.dirname(fullPath);

          let lightningcss = await import("lightningcss");

          let {
            code,
            exports = {},
            map,
          } = await lightningcss.bundleAsync({
            filename: fullPath,
            minify: false,
            sourceMap: true,
            analyzeDependencies: false,
            cssModules: {
              pattern:
                mode === "production" ? "[hash]" : "[name]_[local]_[hash]",
              dashedIdents: false,
            },
            resolver: {
              async resolve(specifier, originatingFile) {
                let resolveDir = path.dirname(originatingFile);
                return (await build.resolve(specifier, { resolveDir })).path;
              },
            },
          });

          let cssModulesExport: Record<string, string> = {};

          Object.keys(exports)
            .sort() // to keep order consistent in different builds
            .forEach((originClass) => {
              let { name, composes } = exports[originClass];

              cssModulesExport[originClass] =
                name +
                (composes.length
                  ? " " +
                    composes
                      .map((composedClass) => composedClass.name)
                      .join(" ")
                  : "");
            });

          let css = code.toString("utf-8");

          if (map) {
            css += `\n/*# sourceMappingURL=data:application/json;base64,${map.toString(
              "base64"
            )} */`;
          }

          // fix path issue on Windows: https://github.com/indooorsman/css-modules-plugin/issues/12
          let cssImportPath =
            "./" +
            cssFileName
              .split(path.sep)
              .join(path.posix.sep)
              .trim()
              .replace(buildingCssSuffix, "") +
            builtCssSuffix;

          // => ./xxx.module.css?css-modules-plugin-built
          let js = [
            `import "${cssImportPath}";`,
            `export default ${JSON.stringify(cssModulesExport)};`,
          ].join("\n");

          return {
            pluginName,
            resolveDir,
            loader: "js" as const,
            contents: js,
            pluginData: {
              ...pluginData,
              css,
              exports,
            },
          };
        }
      );

      // resolve virtual path xxx.module.css?css-modules-plugin-built
      build.onResolve(
        { filter: builtModulesCssRegExp, namespace: pluginNamespace },
        async (args) => {
          let { pluginData = {} } = args;
          let { relativePathToBuildRoot } = pluginData;

          return {
            pluginName,
            namespace: pluginNamespace,
            path: relativePathToBuildRoot + builtCssSuffix,
            external: false,
            sideEffects: true,
            pluginData,
          };
        }
      );

      // load virtual path xxx.module.css?css-modules-plugin-built
      build.onLoad(
        { filter: builtModulesCssRegExp, namespace: pluginNamespace },
        async (args) => {
          let { pluginData } = args;
          let { css, relativePathToBuildRoot } = pluginData;
          let absPath = path.resolve(buildRoot, relativePathToBuildRoot);
          let resolveDir = path.dirname(absPath);

          return {
            pluginName,
            pluginData,
            resolveDir,
            loader: "css" as const,
            contents: css,
          };
        }
      );
    },
  };
};
