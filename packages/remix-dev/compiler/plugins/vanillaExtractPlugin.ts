import { dirname, join } from "path";
import type { IdentifierOption } from "@vanilla-extract/integration";
import {
  cssFileFilter,
  virtualCssFileFilter,
  processVanillaFile,
  getSourceFromVirtualCssFile,
  vanillaExtractTransformPlugin,
} from "@vanilla-extract/integration";
import * as fse from "fs-extra";
import * as esbuild from "esbuild";

import type { CompileOptions } from "../options";
import { loaders } from "../loaders";

const vanillaCssNamespace = "vanilla-extract-css-ns";

export function vanillaExtractPlugin({
  mode,
  outputCss,
}: {
  mode: CompileOptions["mode"];
  outputCss: boolean;
}): esbuild.Plugin {
  return {
    name: "vanilla-extract",
    setup(build) {
      build.onResolve({ filter: virtualCssFileFilter }, (args) => {
        return {
          path: args.path,
          namespace: vanillaCssNamespace,
        };
      });

      build.onLoad(
        { filter: /.*/, namespace: vanillaCssNamespace },
        async ({ path }) => {
          let { source, fileName } = await getSourceFromVirtualCssFile(path);
          let rootDir = build.initialOptions.absWorkingDir ?? process.cwd();
          let resolveDir = dirname(join(rootDir, fileName));

          return {
            contents: source,
            loader: "css",
            resolveDir,
          };
        }
      );

      build.onLoad({ filter: cssFileFilter }, async ({ path: filePath }) => {
        let identOption: IdentifierOption =
          mode === "production" ? "short" : "debug";

        let { outputFiles } = await esbuild.build({
          entryPoints: [filePath],
          outdir:
            build.initialOptions.outdir ??
            (build.initialOptions.outfile
              ? dirname(build.initialOptions.outfile)
              : undefined),
          assetNames: build.initialOptions.assetNames,
          bundle: true,
          external: ["@vanilla-extract"],
          platform: "node",
          write: false,
          plugins: [
            vanillaExtractTransformPlugin({ identOption }) as esbuild.Plugin,
          ],
          loader: loaders,
          absWorkingDir: build.initialOptions.absWorkingDir ?? process.cwd(),
          publicPath: build.initialOptions.publicPath,
        });

        let source = outputFiles
          .reverse()
          .find((file) => file.path.endsWith(".js"))?.text;

        if (!source) {
          return null;
        }

        let [contents] = await Promise.all([
          processVanillaFile({
            source,
            filePath,
            outputCss,
            identOption,
          }),
          ...(outputCss
            ? outputFiles
                .filter((file) => !file.path.endsWith(".js"))
                .map(async (file) => {
                  await fse.ensureDir(dirname(file.path));
                  await fse.writeFile(file.path, file.contents);
                })
            : []),
        ]);

        return {
          contents,
          resolveDir: dirname(filePath),
          loader: "js",
        };
      });
    },
  };
}
