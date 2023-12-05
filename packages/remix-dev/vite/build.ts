import type * as Vite from "vite";

import { extractPluginConfig } from "./extract-plugin-config";

export interface ViteBuildOptions {
  assetsInlineLimit?: number;
  clearScreen?: boolean;
  config?: string;
  emptyOutDir?: boolean;
  force?: boolean;
  logLevel?: Vite.LogLevel;
  minify?: Vite.BuildOptions["minify"];
  mode?: string;
}

export async function build(
  root: string,
  {
    assetsInlineLimit,
    clearScreen,
    config: configFile,
    emptyOutDir,
    force,
    logLevel,
    minify,
    mode,
  }: ViteBuildOptions
) {
  // For now we just use this function to validate that the Vite config is
  // targeting Remix, but in the future the return value can be used to
  // configure the entire multi-step build process.
  await extractPluginConfig({
    command: "serve",
    configFile,
    mode,
    root,
  });

  let vite = await import("vite");

  async function viteBuild({ ssr }: { ssr: boolean }) {
    await vite.build({
      build: { assetsInlineLimit, emptyOutDir, minify, ssr },
      clearScreen,
      configFile,
      logLevel,
      mode,
      optimizeDeps: { force },
    });
  }

  await viteBuild({ ssr: false });
  await viteBuild({ ssr: true });
}
