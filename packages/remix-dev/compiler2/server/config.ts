import type esbuild from "esbuild";
import { pnpPlugin as yarnPnpPlugin } from "@yarnpkg/esbuild-plugin-pnp";
import NodeModulesPolyfillPlugin from "@esbuild-plugins/node-modules-polyfill";

import type { Options } from "../../compiler-kit";
import { loaders } from "../../compiler/loaders";
import { emptyModulesPlugin } from "../../compiler/plugins/emptyModulesPlugin";
import { mdxPlugin } from "../../compiler/plugins/mdx";
import { serverBareModulesPlugin } from "../../compiler/plugins/serverBareModulesPlugin";
import { serverEntryModulePlugin } from "../../compiler/plugins/serverEntryModulePlugin";
import { serverRouteModulesPlugin } from "../../compiler/plugins/serverRouteModulesPlugin";
import { urlImportsPlugin } from "../../compiler/plugins/urlImportsPlugin";
import type { RemixConfig } from "../../config";
import { assetsManifestPlugin } from "./plugins/assets-manifest";
import type { ReadChannel } from "../../compiler-kit/utils/channel";
import type { AssetsManifest } from "../../compiler/assets";

export const createEsbuildConfig = (
  remixConfig: RemixConfig,
  manifestChannel: ReadChannel<AssetsManifest>,
  options: Options
): esbuild.BuildOptions => {
  let stdin: esbuild.StdinOptions | undefined;
  let entryPoints: string[] | undefined;

  if (remixConfig.serverEntryPoint) {
    entryPoints = [remixConfig.serverEntryPoint];
  } else {
    stdin = {
      contents: remixConfig.serverBuildTargetEntryModule,
      resolveDir: remixConfig.rootDirectory,
      loader: "ts",
    };
  }

  let isCloudflareRuntime = ["cloudflare-pages", "cloudflare-workers"].includes(
    remixConfig.serverBuildTarget ?? ""
  );
  let isDenoRuntime = remixConfig.serverBuildTarget === "deno";

  let plugins: esbuild.Plugin[] = [
    urlImportsPlugin(),
    mdxPlugin(remixConfig),
    emptyModulesPlugin(remixConfig, /\.client(\.[jt]sx?)?$/),
    serverRouteModulesPlugin(remixConfig),
    serverEntryModulePlugin(remixConfig),
    assetsManifestPlugin(manifestChannel.read()),
    serverBareModulesPlugin(remixConfig, options.onWarning),
    yarnPnpPlugin(),
  ];

  if (remixConfig.serverPlatform !== "node") {
    plugins.unshift(NodeModulesPolyfillPlugin());
  }

  return {
    absWorkingDir: remixConfig.rootDirectory,
    stdin,
    entryPoints,
    outfile: remixConfig.serverBuildPath,
    write: false,
    conditions: isCloudflareRuntime
      ? ["worker"]
      : isDenoRuntime
      ? ["deno", "worker"]
      : undefined,
    platform: remixConfig.serverPlatform,
    format: remixConfig.serverModuleFormat,
    treeShaking: true,
    // The type of dead code elimination we want to do depends on the
    // minify syntax property: https://github.com/evanw/esbuild/issues/672#issuecomment-1029682369
    // Dev builds are leaving code that should be optimized away in the
    // bundle causing server / testing code to be shipped to the browser.
    // These are properly optimized away in prod builds today, and this
    // PR makes dev mode behave closer to production in terms of dead
    // code elimination / tree shaking is concerned.
    minifySyntax: true,
    minify: options.mode === "production" && isCloudflareRuntime,
    mainFields: isCloudflareRuntime
      ? ["browser", "module", "main"]
      : remixConfig.serverModuleFormat === "esm"
      ? ["module", "main"]
      : ["main", "module"],
    target: options.target,
    loader: loaders,
    bundle: true,
    logLevel: "silent",
    // As pointed out by https://github.com/evanw/esbuild/issues/2440, when tsconfig is set to
    // `undefined`, esbuild will keep looking for a tsremixConfig.json recursively up. This unwanted
    // behavior can only be avoided by creating an empty tsconfig file in the root directory.
    tsconfig: remixConfig.tsconfigPath,
    // TODO(pcattori): removed`incremental: options.incremental,`
    sourcemap: options.sourcemap, // use linked (true) to fix up .map file
    // The server build needs to know how to generate asset URLs for imports
    // of CSS and other files.
    assetNames: "_assets/[name]-[hash]",
    publicPath: remixConfig.publicPath,
    define: {
      "process.env.NODE_ENV": JSON.stringify(options.mode),
      "process.env.REMIX_DEV_SERVER_WS_PORT": JSON.stringify(
        remixConfig.devServerPort
      ),
    },
    jsx: "automatic",
    jsxDev: options.mode !== "production",
    plugins,
  };
  // TODO(pcattori):
  // .then(async (build) => {
  //   await writeServerBuildResult(config, build.outputFiles);
  //   return build;
  // }
};
