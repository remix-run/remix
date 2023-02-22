import { dirname, join, posix } from "path";
import { cssFileFilter } from "@vanilla-extract/integration";
import type { Plugin } from "esbuild";

import type { RemixConfig } from "../../config";
import type { CompileOptions } from "../options";
import { loaders } from "../loaders";
import { getPostcssProcessor } from "../utils/postcss";
import { createVanillaExtractCompiler } from "./vanilla-extract/vanillaExtractCompiler";

let compiler: ReturnType<typeof createVanillaExtractCompiler>;

let virtualCssFileSuffix = ".vanilla.css";
let virtualCssFileFilter = /\.vanilla\.css/;

const staticAssetRegexp = new RegExp(
  `(${Object.keys(loaders)
    .filter((ext) => ext !== ".css" && loaders[ext] === "file")
    .join("|")})$`
);

const pluginName = "vanilla-extract-plugin";
const namespace = `${pluginName}-ns`;

export function vanillaExtractPlugin({
  config,
  mode,
  outputCss,
}: {
  config: RemixConfig;
  mode: CompileOptions["mode"];
  outputCss: boolean;
}): Plugin {
  return {
    name: pluginName,
    async setup(build) {
      let root = config.appDirectory;

      compiler =
        compiler ||
        createVanillaExtractCompiler({
          root,
          identOption: mode === "production" ? "short" : "debug",
          toCssImport(filePath) {
            return filePath + virtualCssFileSuffix;
          },
          vitePlugins: [
            {
              name: "remix-assets",
              enforce: "pre",
              async resolveId(source) {
                // Handle root-relative imports within Vanilla Extract files
                if (source.startsWith("~")) {
                  return await this.resolve(source.replace("~", ""));
                }
                // Handle static asset JS imports
                if (source.startsWith("/") && staticAssetRegexp.test(source)) {
                  return {
                    external: true,
                    id: "__REMIX_STATIC_ASSET_PREFIX__" + source,
                  };
                }
              },
              transform(code) {
                return code.replace(
                  /\/@fs\/__REMIX_STATIC_ASSET_PREFIX__\//g,
                  "~/"
                );
              },
            },
          ],
        });

      let postcssProcessor = await getPostcssProcessor({
        config,
        context: {
          vanillaExtract: true,
        },
      });

      // Resolve virtual CSS files first to avoid resolving the same
      // file multiple times since this filter is more specific and
      // doesn't require a file system lookup.
      build.onResolve({ filter: virtualCssFileFilter }, (args) => {
        return {
          path: args.path,
          namespace,
        };
      });

      vanillaExtractSideEffectsPlugin.setup(build);

      build.onLoad(
        { filter: virtualCssFileFilter, namespace },
        async ({ path }) => {
          let [relativeFilePath] = path.split(virtualCssFileSuffix);

          let { css, filePath } = compiler.getCssForFile(
            posix.join(root, relativeFilePath)
          );

          let resolveDir = dirname(join(root, filePath));

          if (postcssProcessor) {
            css = (
              await postcssProcessor.process(css, {
                from: path,
                to: path,
              })
            ).css;
          }

          return {
            contents: css,
            loader: "css",
            resolveDir,
          };
        }
      );

      build.onLoad({ filter: cssFileFilter }, async ({ path: filePath }) => {
        let { source, watchFiles } = await compiler.processVanillaFile(
          filePath,
          outputCss
        );

        return {
          contents: source,
          resolveDir: dirname(filePath),
          loader: "js",
          watchFiles: Array.from(watchFiles || []),
        };
      });
    },
  };
}

/**
 * This plugin marks all .css.ts/js files as having side effects. This is
 * to ensure that all usages of `globalStyle` are included in the CSS bundle,
 * even if a .css.ts/js file has no exports or is otherwise tree-shaken.
 */
const vanillaExtractSideEffectsPlugin: Plugin = {
  name: "vanilla-extract-side-effects-plugin",
  setup(build) {
    let preventInfiniteLoop = {};

    build.onResolve(
      { filter: /\.css(\.(j|t)sx?)?(\?.*)?$/, namespace: "file" },
      async (args) => {
        if (args.pluginData === preventInfiniteLoop) {
          return null;
        }

        let resolvedPath = (
          await build.resolve(args.path, {
            resolveDir: args.resolveDir,
            kind: args.kind,
            pluginData: preventInfiniteLoop,
          })
        ).path;

        if (!cssFileFilter.test(resolvedPath)) {
          return null;
        }

        return {
          path: resolvedPath,
          sideEffects: true,
        };
      }
    );
  },
};
