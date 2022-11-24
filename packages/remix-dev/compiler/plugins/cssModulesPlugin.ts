import { type CompileOptions } from "../options";
import esbuildCssModulesPlugin from "./esbuild-plugin-css-modules/index.js";

export function cssModulesPlugin({ mode }: { mode: CompileOptions["mode"] }) {
  return esbuildCssModulesPlugin({
    inject: false,
    filter: /\.module\.css$/i, // The default includes support for "*.modules.css", so we're limiting the scope here
    v2: true,
    v2CssModulesOption: {
      pattern: mode === "production" ? "[hash]" : "[name]_[local]_[hash]",
    },
  });
}
