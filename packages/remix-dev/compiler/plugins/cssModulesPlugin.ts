import path from "path";
import type { Plugin, PluginBuild } from "esbuild";

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
      let cwd = process.cwd();

      build.onLoad({ filter: cssModulesFilter }, async (args) => {
        let { path: absolutePath } = args;

        let lightningcss = await import("lightningcss");

        let {
          code: compiledCssBuffer,
          exports: exportsMeta = {},
          map,
        } = await lightningcss.bundleAsync({
          // Path must be relative to ensure stable hashes.
          // Also, we can only generate stable hashes relative to cwd right now:
          // https://github.com/parcel-bundler/lightningcss/issues/355
          filename: path.relative(cwd, absolutePath),
          minify: false,
          sourceMap: options.mode !== "production",
          analyzeDependencies: false,
          cssModules: {
            pattern:
              options.mode === "production"
                ? "[hash]_[local]" // We need to leave the local name in production for now because of this hashing issue: https://github.com/parcel-bundler/lightningcss/issues/351
                : "[hash]_[name]_[local]", // [local] must be at the end to support scoped grid line names: https://github.com/parcel-bundler/lightningcss/issues/351#issuecomment-1342099486
            dashedIdents: false,
          },
          resolver: {
            async resolve(specifier, originatingFile) {
              let resolveDir = path.dirname(originatingFile);

              let absolutePath = (
                await build.resolve(specifier, { resolveDir })
              ).path;

              return path.relative(cwd, absolutePath); // Path must be relative to ensure stable hashes
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
          path: path.relative(cwd, absolutePath),
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
