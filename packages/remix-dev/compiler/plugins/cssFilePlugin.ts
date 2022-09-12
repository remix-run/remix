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
        let { metafile } = await esbuild.build({
          ...buildOps,
          minify: buildConfig.mode === BuildMode.Production,
          minifySyntax: true,
          metafile: true,
          write: true,
          sourcemap: false, // hash depends on sourcemap
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

        let keys = Object.keys(metafile.outputs);
        let entry = keys.find((key) => {
          let { entryPoint } = metafile.outputs[key];
          return !!entryPoint;
        });

        return {
          contents: fse.readFileSync(entry!),
          loader: "file",
        };
      });
    },
  };
}
