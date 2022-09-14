import * as path from "path";
import * as fse from "fs-extra";
import esbuild from "esbuild";

import { BuildMode } from "../../build";
import type { BuildConfig } from "../../compiler";

/**
 * This plugin loads css files with the "css" loader (bundles and moves assets to assets directory)
 * and exports the url of the css file as its default export.
 */
export function cssFilePlugin(
  buildConfig: Partial<BuildConfig>
): esbuild.Plugin {
  return {
    name: "css-file",

    async setup(build) {
      let buildOps = build.initialOptions;

      build.onLoad({ filter: /\.css$/ }, async (args) => {
        let { outfile, outdir, assetNames } = buildOps;
        let { metafile, outputFiles } = await esbuild.build({
          ...buildOps,
          minify: buildConfig.mode === BuildMode.Production,
          minifySyntax: true,
          metafile: true,
          write: false,
          sourcemap: false,
          incremental: false,
          splitting: false,
          stdin: undefined,
          outfile: undefined,
          outdir: outfile ? path.dirname(outfile) : outdir,
          entryNames: assetNames,
          entryPoints: [args.path],
          loader: {
            ...buildOps.loader,
            ".css": "css",
          },
          plugins: [
            {
              name: "resolve-absolute",
              async setup(build) {
                build.onResolve({ filter: /.*/ }, async (args) => {
                  let { kind, path: resolvePath } = args;
                  if (kind === "url-token" && path.isAbsolute(resolvePath)) {
                    return {
                      path: resolvePath,
                      external: true,
                    };
                  }
                });
              },
            },
          ],
        });

        let { outputs } = metafile!;
        let entry = Object.keys(outputs).find(
          (out) => outputs[out].entryPoint
        )!;
        let entryFile = outputFiles!.find((file) => file.path.endsWith(entry))!;
        let outputFilesWithoutEntry = outputFiles!.filter(
          (file) => file !== entryFile
        );

        // create directories for the assets
        await Promise.all(
          outputFilesWithoutEntry.map(({ path: filepath }) =>
            fse.promises.mkdir(path.dirname(filepath), { recursive: true })
          )
        );
        // write all assets
        await Promise.all(
          outputFilesWithoutEntry.map(({ path: filepath, contents }) =>
            fse.promises.writeFile(filepath, contents)
          )
        );

        return {
          contents: entryFile.contents,
          loader: "file",
          // add all css assets to watchFiles
          watchFiles: Object.values(outputs).reduce((arr, { inputs }) => {
            let resolvedInputs = Object.keys(inputs).map((input) =>
              path.resolve(input)
            );
            arr.push(...resolvedInputs);
            return arr;
          }, [] as string[]),
        };
      });
    },
  };
}
