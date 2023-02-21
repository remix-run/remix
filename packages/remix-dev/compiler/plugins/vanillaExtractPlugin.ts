import { dirname, join, extname, posix } from "path";
import type { IdentifierOption } from "@vanilla-extract/integration";
import { cssFileFilter, transform } from "@vanilla-extract/integration";
import * as fse from "fs-extra";
import type { Plugin, OutputFile, Loader } from "esbuild";

import type { RemixConfig } from "../../config";
import type { CompileOptions } from "../options";
import { getPostcssProcessor } from "../utils/postcss";
import { createVanillaExtractCompiler } from "./vanilla-extract/vanillaExtractCompiler";

let compiler: ReturnType<typeof createVanillaExtractCompiler>;

let virtualCssFileFilter = /\.vanilla\.css/;

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
      let root = config.rootDirectory;

      compiler =
        compiler ||
        createVanillaExtractCompiler({
          root,
          identOption: mode === "production" ? "short" : "debug",
          toCssImport(filePath) {
            return posix.relative(root, filePath) + ".vanilla.css";
          },
          alias: {
            "~": config.appDirectory,
          },
        });

      let postcssProcessor = await getPostcssProcessor({
        config,
        context: {
          vanillaExtract: true,
        },
      });
      let { rootDirectory } = config;

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
          let [relativeFilePath] = path.split(".vanilla.css");

          let { css, filePath } = compiler.getCssForFile(
            posix.join(root, relativeFilePath)
          );

          let resolveDir = dirname(join(rootDirectory, filePath));

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

async function writeAssets(outputFiles: Array<OutputFile>): Promise<void> {
  await Promise.all(
    outputFiles
      .filter((file) => !file.path.endsWith(".js"))
      .map(async (file) => {
        await fse.ensureDir(dirname(file.path));
        await fse.writeFile(file.path, file.contents);
      })
  );
}

const loaderForExtension: Record<string, Loader> = {
  ".js": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".tsx": "tsx",
};

/**
 * This plugin is used within the child compilation. It applies the Vanilla
 * Extract file transform to all .css.ts/js files. This is used to add "file
 * scope" annotations, which is done via function calls at the beginning and end
 * of each file so that we can tell which CSS file the styles belong to when
 * evaluating the JS. It's also done to automatically apply debug IDs.
 */
function vanillaExtractTransformPlugin({
  rootDirectory,
  identOption,
}: {
  identOption: IdentifierOption;
  rootDirectory: string;
}): Plugin {
  return {
    name: "vanilla-extract-transform-plugin",
    setup(build) {
      build.onLoad({ filter: cssFileFilter }, async ({ path }) => {
        let source = await fse.readFile(path, "utf-8");

        let contents = await transform({
          source,
          filePath: path,
          rootPath: rootDirectory,
          packageName: "remix-app", // This option is designed to support scoping hashes for libraries, we can hard code an arbitrary value for simplicity
          identOption,
        });

        return {
          contents,
          loader: loaderForExtension[extname(path)],
          resolveDir: dirname(path),
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
