import { defineConfig } from "tsup";
import { vanillaExtractPlugin } from "@vanilla-extract/esbuild-plugin";

export default defineConfig((options) => ({
  entry: [".styles/index.ts"],
  outDir: "app/styles",
  splitting: false,
  clean: !options.watch,
  dts: true,
  format: "cjs",
  esbuildPlugins: [
    vanillaExtractPlugin({
      identifiers: options.watch ? "debug" : "short",
    }),
  ],
}));
