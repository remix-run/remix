import path from "path";
import type { Plugin, PluginBuild } from "esbuild";

import type { CompileOptions } from "../options";

const pluginName = "css-modules-plugin";
const namespace = `${pluginName}-ns`;
const cssModulesFilter = /\.module\.css$/;
const compiledCssSuffix = "?compiled";
const compiledCssFilter = /\?compiled$/;

export const cssModulesPlugin = (options: CompileOptions): Plugin => {
  return {
    name: pluginName,
    setup: async (build: PluginBuild) => {
      build.onResolve(
        { filter: cssModulesFilter, namespace: "file" },
        async (args) => {
          let { path: importPath, resolveDir } = args;
          let { path: absolutePath } = await build.resolve(importPath, {
            resolveDir,
          });

          return {
            namespace,
            path: absolutePath,
            sideEffects: true,
            pluginData: {
              absolutePath,
            },
          };
        }
      );

      build.onLoad({ filter: cssModulesFilter, namespace }, async (args) => {
        let { path: absolutePath, pluginData } = args;

        let lightningcss = await import("lightningcss");

        let {
          code: compiledCssBuffer,
          exports: exportsMeta = {},
          map,
        } = await lightningcss.bundleAsync({
          filename: absolutePath,
          minify: false,
          sourceMap: options.mode !== "production",
          analyzeDependencies: false,
          cssModules: {
            pattern:
              options.mode === "production"
                ? "[hash]"
                : "[name]_[local]_[hash]",
            dashedIdents: false,
          },
          resolver: {
            async resolve(specifier, originatingFile) {
              let resolveDir = path.dirname(originatingFile);
              return (await build.resolve(specifier, { resolveDir })).path;
            },
          },
        });

        let exports: Record<string, string> = {};

        for (let exportName in exportsMeta) {
          let { name, composes } = exportsMeta[exportName];

          let composedClasses = composes.length
            ? composes.map((composedClass) => composedClass.name).join(" ")
            : null;

          exports[exportName] = `${name}${
            composedClasses ? ` ${composedClasses}` : ""
          }`;
        }

        let compiledCss = compiledCssBuffer.toString("utf-8");

        if (map) {
          let mapBase64 = map.toString("base64");
          compiledCss += `\n/*# sourceMappingURL=data:application/json;base64,${mapBase64} */`;
        }

        let contents = [
          `import "./${path.basename(absolutePath)}${compiledCssSuffix}";`,
          `export default ${JSON.stringify(exports)};`,
        ].join("\n");

        return {
          contents,
          resolveDir: path.dirname(absolutePath),
          loader: "js" as const,
          pluginData: {
            ...pluginData,
            compiledCss,
          },
        };
      });

      build.onResolve(
        { filter: compiledCssFilter, namespace },
        async (args) => {
          let { pluginData, path } = args;

          return {
            namespace,
            path,
            pluginData,
          };
        }
      );

      build.onLoad({ filter: compiledCssFilter, namespace }, async (args) => {
        let { pluginData } = args;
        let { compiledCss, absolutePath } = pluginData;
        let resolveDir = path.dirname(absolutePath);

        return {
          resolveDir,
          contents: compiledCss,
          loader: "css" as const,
        };
      });
    },
  };
};
