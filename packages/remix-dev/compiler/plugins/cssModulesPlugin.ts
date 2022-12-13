import path from "path";
import type { Plugin, PluginBuild } from "esbuild";
import fse from "fs-extra";
import postcss from "postcss";
import postcssModules from "postcss-modules";

import type { CompileOptions } from "../options";

const pluginName = "css-modules-plugin";
const namespace = `${pluginName}-ns`;
const cssModulesFilter = /\.module\.css$/;
const compiledCssQueryString = "?css-modules-plugin-compiled-css";
const compiledCssFilter = /\?css-modules-plugin-compiled-css$/;

interface PluginData {
  absolutePath: string;
  compiledCss: string;
}

export const cssModulesPlugin = (options: CompileOptions): Plugin => {
  return {
    name: pluginName,
    setup: async (build: PluginBuild) => {
      build.onResolve(
        { filter: cssModulesFilter, namespace: "file" },
        async (args) => {
          let resolvedPath = (
            await build.resolve(args.path, {
              resolveDir: args.resolveDir,
              kind: args.kind,
            })
          ).path;

          return {
            path: resolvedPath,
          };
        }
      );

      build.onLoad({ filter: cssModulesFilter }, async (args) => {
        let { path: absolutePath } = args;

        let fileContents = await fse.readFile(absolutePath, "utf8");
        let exports: Record<string, string> = {};

        let { css: compiledCss, map } = await postcss([
          postcssModules({
            generateScopedName:
              options.mode === "production"
                ? "[hash:base64:5]"
                : "[name]__[local]__[hash:base64:5]",
            getJSON: function (_, json) {
              exports = json;
            },
            async resolve(id, importer) {
              return (
                await build.resolve(id, {
                  resolveDir: path.dirname(importer),
                  kind: "require-resolve",
                })
              ).path;
            },
          }),
        ]).process(fileContents, {
          from: absolutePath,
          to: absolutePath,
          ...(options.mode !== "production"
            ? {
                map: {
                  inline: false,
                  annotation: false,
                  sourcesContent: true,
                },
              }
            : undefined),
        });

        if (map) {
          let mapBase64 = Buffer.from(map.toString()).toString("base64");
          compiledCss += `\n/*# sourceMappingURL=data:application/json;base64,${mapBase64} */`;
        }

        let pluginData: PluginData = {
          absolutePath,
          compiledCss,
        };

        let contents = [
          `import "./${path.basename(absolutePath)}${compiledCssQueryString}";`,
          `export default ${JSON.stringify(exports)};`,
        ].join("\n");

        return {
          contents,
          loader: "js" as const,
          pluginData,
        };
      });

      build.onResolve({ filter: compiledCssFilter }, async (args) => {
        let pluginData: PluginData = args.pluginData;
        let absolutePath = path.resolve(args.resolveDir, args.path);

        return {
          namespace,
          path: absolutePath,
          pluginData,
        };
      });

      build.onLoad({ filter: compiledCssFilter, namespace }, async (args) => {
        let pluginData: PluginData = args.pluginData;
        let { compiledCss, absolutePath } = pluginData;

        return {
          resolveDir: path.dirname(absolutePath),
          contents: compiledCss,
          loader: "css" as const,
        };
      });
    },
  };
};
