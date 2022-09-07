import * as path from "path";
import esbuild from "esbuild";

import type { RemixConfig } from "../../config";

/**
 * This plugin loads css files with the "css" loader (bundles and moves assets to assets directory)
 * and exports the url of the css file as its default export.
 */
export function cssFilePlugin(config: RemixConfig): esbuild.Plugin {
  return {
    name: "css-file",

    async setup(build) {
      let buildOptions = build.initialOptions;

      build.onLoad({ filter: /\.css$/ }, async (args) => {
        let { outfile, outdir, assetNames } = buildOptions;
        let assetDirname = path.dirname(assetNames!);
        let { metafile } = await esbuild.build({
          ...buildOptions,
          minifySyntax: false,
          incremental: false,
          splitting: false,
          sourcemap: false,
          write: true,
          stdin: undefined,
          outfile: undefined,
          outdir: path.join(
            outfile ? path.dirname(outfile)! : outdir!,
            assetDirname
          ),
          entryPoints: [args.path],
          assetNames: "[name]-[hash]",
          entryNames: "[dir]/[name]-[hash]",
          publicPath: ".",
          loader: {
            ...buildOptions.loader,
            ".css": "css",
          },
          metafile: true,
          plugins: [
            {
              name: "external-absolute-url",
              async setup(cssBuild) {
                cssBuild.onResolve({ filter: /.*/ }, async (args) => {
                  let { kind, path: resolvePath } = args;
                  if (kind === "url-token" && path.isAbsolute(resolvePath)) {
                    return {
                      path: resolvePath,
                      external: true,
                    };
                  }
                  return {};
                });
              },
            },
          ],
        });

        let keys = Object.keys(metafile.outputs);
        let entry = keys.find((key) => {
          let { entryPoint } = metafile.outputs[key];
          return !!entryPoint;
        })!;

        return {
          contents: `export default "${path.join(
            config.publicPath,
            assetDirname,
            path.basename(entry)
          )}";`,
          loader: "js",
        };
      });
    },
  };
}
