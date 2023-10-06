import type { Plugin } from "esbuild";

import type { Context } from "../context";

export function scssFilePlugin({ config }: Context): Plugin {
  return {
    name: "scss-file",

    async setup(build) {
      if (!config?.future?.scss) {
        return
      }

      let sassPlugin

      try {
        let { sassPlugin: importedSassPlugin } = await import("esbuild-sass-plugin");
        sassPlugin = importedSassPlugin
      } catch (error) {
        console.warn("Detected a 'scssImports' plugin enabled without having 'esbuild-sass-plugin' installed. Please install 'esbuild-sass-plugin' package.");

        return
      }

      sassPlugin({
        filter: /\.scss$/
      }).setup(build)
    },
  };
}
