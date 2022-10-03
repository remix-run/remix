import path from "path";
import type esbuild from "esbuild";
import NodeModulesPolyfillPlugin from "@esbuild-plugins/node-modules-polyfill";
import { pnpPlugin as yarnPnpPlugin } from "@yarnpkg/esbuild-plugin-pnp";
import { builtinModules as nodeBuiltins } from "module";

import { loaders } from "../../compiler/loaders";
import type { RemixConfig } from "../../config";
import { urlImportsPlugin } from "../../compiler/plugins/urlImportsPlugin";
import { mdxPlugin } from "../../compiler/plugins/mdx";
import { browserRouteModulesPlugin } from "../../compiler/plugins/browserRouteModulesPlugin";
import { emptyModulesPlugin } from "../../compiler/plugins/emptyModulesPlugin";
import { getAppDependencies } from "../../compiler/dependencies";
import type { Options } from "../../compiler-kit";

const getExternals = (remixConfig: RemixConfig): string[] => {
  // For the browser build, exclude node built-ins that don't have a
  // browser-safe alternative installed in node_modules. Nothing should
  // *actually* be external in the browser build (we want to bundle all deps) so
  // this is really just making sure we don't accidentally have any dependencies
  // on node built-ins in browser bundles.
  let dependencies = Object.keys(getAppDependencies(remixConfig));
  let fakeBuiltins = nodeBuiltins.filter((mod) => dependencies.includes(mod));

  if (fakeBuiltins.length > 0) {
    throw new Error(
      `It appears you're using a module that is built in to node, but you installed it as a dependency which could cause problems. Please remove ${fakeBuiltins.join(
        ", "
      )} before continuing.`
    );
  }
  return nodeBuiltins.filter((mod) => !dependencies.includes(mod));
};

export const createEsbuildConfig = (
  remixConfig: RemixConfig,
  options: Options
): esbuild.BuildOptions | esbuild.BuildIncremental => {
  let entryPoints: esbuild.BuildOptions["entryPoints"] = {
    "entry.client": path.resolve(
      remixConfig.appDirectory,
      remixConfig.entryClientFile
    ),
  };
  for (let id of Object.keys(remixConfig.routes)) {
    // All route entry points are virtual modules that will be loaded by the
    // browserEntryPointsPlugin. This allows us to tree-shake server-only code
    // that we don't want to run in the browser (i.e. action & loader).
    entryPoints[id] = remixConfig.routes[id].file + "?browser";
  }

  return {
    entryPoints,
    outdir: remixConfig.assetsBuildDirectory,
    platform: "browser",
    format: "esm",
    external: getExternals(remixConfig),
    loader: loaders,
    bundle: true,
    logLevel: "silent",
    splitting: true,
    sourcemap: options.sourcemap,
    // As pointed out by https://github.com/evanw/esbuild/issues/2440, when tsconfig is set to
    // `undefined`, esbuild will keep looking for a tsconfig.json recursively up. This unwanted
    // behavior can only be avoided by creating an empty tsconfig file in the root directory.
    tsconfig: remixConfig.tsconfigPath,
    mainFields: ["browser", "module", "main"],
    treeShaking: true,
    minify: options.mode === "production",
    entryNames: "[dir]/[name]-[hash]",
    chunkNames: "_shared/[name]-[hash]",
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
    plugins: [
      urlImportsPlugin(),
      mdxPlugin(remixConfig),
      browserRouteModulesPlugin(remixConfig, /\?browser$/),
      emptyModulesPlugin(remixConfig, /\.server(\.[jt]sx?)?$/),
      NodeModulesPolyfillPlugin(),
      yarnPnpPlugin(),
    ],
  };
};
