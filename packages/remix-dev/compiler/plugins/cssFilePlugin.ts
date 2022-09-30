import * as path from "path";
import * as fse from "fs-extra";
import esbuild from "esbuild";

import { BuildMode } from "../../build";
import type { BuildConfig } from "../../compiler";

const isExtendedLengthPath = /^\\\\\?\\/;

const normalizePathSlashes = (path: string) =>
  isExtendedLengthPath.test(path) ? path : path.replace(/\\/g, "/");

/**
 * This plugin loads css files with the "css" loader (bundles and moves assets to assets directory)
 * and exports the url of the css file as its default export.
 */
export function cssFilePlugin(
  buildConfig: Pick<Partial<BuildConfig>, "mode">
): esbuild.Plugin {
  return {
    name: "css-file",

    async setup(build) {
      let buildOps = build.initialOptions;

      build.onLoad({ filter: /\.css$/ }, async (args) => {
        let { outfile, outdir, assetNames } = buildOps;
        let { metafile, outputFiles, warnings, errors } = await esbuild.build({
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
          // this plugin treats absolute paths in 'url()' css rules as external to prevent breaking changes
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

        if (errors) {
          return { errors };
        }

        let { outputs } = metafile!;
        let entry = Object.keys(outputs).find(
          (out) => outputs[out].entryPoint
        )!;
        let entryFile = outputFiles!.find((file) =>
          normalizePathSlashes(file.path).endsWith(normalizePathSlashes(entry))
        )!;
        let outputFilesWithoutEntry = outputFiles!.filter(
          (file) => file !== entryFile
        );

        // write all assets
        await Promise.all(
          outputFilesWithoutEntry.map(({ path: filepath, contents }) =>
            fse.outputFile(filepath, contents)
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
          warnings,
        };
      });
    },
  };
}
