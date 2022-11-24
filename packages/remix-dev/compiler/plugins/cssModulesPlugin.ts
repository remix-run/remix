import { type CompileOptions } from "../options";
import esbuildCssModulesPlugin from "./esbuild-plugin-css-modules/index.js";

type CssModulesPluginOptions = {
  emitCss: boolean;
  mode: CompileOptions["mode"];
};

export function cssModulesPlugin({ emitCss, mode }: CssModulesPluginOptions) {
  return esbuildCssModulesPlugin({
    emitCss,
    inject: false,
    filter: /\.module\.css$/i, // The default includes support for "*.modules.css", so we're limiting the scope here
    v2: true,
    v2CssModulesOption: {
      pattern: mode === "production" ? "[hash]" : "[name]_[local]_[hash]",
    },
  });
}
