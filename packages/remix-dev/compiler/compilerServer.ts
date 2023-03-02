import * as path from "path";
import * as esbuild from "esbuild";
import * as fse from "fs-extra";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

import invariant from "../invariant";
import type { ReadChannel } from "../channel";
import type { RemixConfig } from "../config";
import type { AssetsManifest } from "./assets";
import { loaders } from "./loaders";
import type { CompileOptions } from "./options";
import { cssModulesPlugin } from "./plugins/cssModulesPlugin";
import { cssSideEffectImportsPlugin } from "./plugins/cssSideEffectImportsPlugin";
import { vanillaExtractPlugin } from "./plugins/vanillaExtractPlugin";
import { cssFilePlugin } from "./plugins/cssFilePlugin";
import { deprecatedRemixPackagePlugin } from "./plugins/deprecatedRemixPackagePlugin";
import { emptyModulesPlugin } from "./plugins/emptyModulesPlugin";
import { mdxPlugin } from "./plugins/mdx";
import { serverAssetsManifestPlugin } from "./plugins/serverAssetsManifestPlugin";
import { serverBareModulesPlugin } from "./plugins/serverBareModulesPlugin";
import { serverEntryModulePlugin } from "./plugins/serverEntryModulePlugin";
import { serverRouteModulesPlugin } from "./plugins/serverRouteModulesPlugin";
import { urlImportsPlugin } from "./plugins/urlImportsPlugin";
import type { RouteManifest } from "../config/routes";

export type ServerCompiler = {
  // produce ./build/index.js
  compile: (manifestChannel: ReadChannel<AssetsManifest>) => Promise<esbuild.Metafile>;
  // produce multiple ./build/[name].js
  compileBundles: (manifestChannel: ReadChannel<AssetsManifest>) => Promise<esbuild.Metafile>[];
  dispose: () => void;
};

const createEsbuildConfig = (
  config: RemixConfig,
  assetsManifestChannel: ReadChannel<AssetsManifest>,
  outfile: string,
  routes: RouteManifest,
  options: CompileOptions
): esbuild.BuildOptions => {
  let stdin: esbuild.StdinOptions | undefined;
  let entryPoints: string[] | undefined;

  if (config.serverEntryPoint) {
    entryPoints = [config.serverEntryPoint];
  } else {
    stdin = {
      contents: config.serverBuildTargetEntryModule,
      resolveDir: config.rootDirectory,
      loader: "ts",
    };
  }

  let { mode } = options;
  let outputCss = false;

  let plugins: esbuild.Plugin[] = [
    deprecatedRemixPackagePlugin(options.onWarning),
    config.future.unstable_cssModules
      ? cssModulesPlugin({ config, mode, outputCss })
      : null,
    config.future.unstable_vanillaExtract
      ? vanillaExtractPlugin({ config, mode, outputCss })
      : null,
    config.future.unstable_cssSideEffectImports
      ? cssSideEffectImportsPlugin({ config, options })
      : null,
    cssFilePlugin({ config, options }),
    urlImportsPlugin(),
    mdxPlugin(config),
    emptyModulesPlugin(config, /\.client(\.[jt]sx?)?$/),
    serverRouteModulesPlugin(config, routes),
    serverEntryModulePlugin(config, routes, { liveReloadPort: options.liveReloadPort }),
    serverAssetsManifestPlugin(assetsManifestChannel.read(), routes),
    serverBareModulesPlugin(config, process.cwd(), options.onWarning),
  ].filter(isNotNull);

  if (config.serverPlatform !== "node") {
    plugins.unshift(NodeModulesPolyfillPlugin());
  }

  return {
    absWorkingDir: config.rootDirectory,
    stdin,
    entryPoints,
    outfile,
    conditions: config.serverConditions,
    platform: config.serverPlatform,
    format: config.serverModuleFormat,
    treeShaking: true,
    // The type of dead code elimination we want to do depends on the
    // minify syntax property: https://github.com/evanw/esbuild/issues/672#issuecomment-1029682369
    // Dev builds are leaving code that should be optimized away in the
    // bundle causing server / testing code to be shipped to the browser.
    // These are properly optimized away in prod builds today, and this
    // PR makes dev mode behave closer to production in terms of dead
    // code elimination / tree shaking is concerned.
    minifySyntax: true,
    minify: options.mode === "production" && config.serverMinify,
    mainFields: config.serverMainFields,
    target: options.target,
    loader: loaders,
    bundle: true,
    logLevel: "silent",
    // As pointed out by https://github.com/evanw/esbuild/issues/2440, when tsconfig is set to
    // `undefined`, esbuild will keep looking for a tsconfig.json recursively up. This unwanted
    // behavior can only be avoided by creating an empty tsconfig file in the root directory.
    tsconfig: config.tsconfigPath,
    sourcemap: options.sourcemap, // use linked (true) to fix up .map file
    // The server build needs to know how to generate asset URLs for imports
    // of CSS and other files.
    assetNames: "_assets/[name]-[hash]",
    publicPath: config.publicPath,
    define: {
      "process.env.NODE_ENV": JSON.stringify(options.mode),
      "process.env.REMIX_DEV_SERVER_WS_PORT": JSON.stringify(
        config.devServerPort
      ),
    },
    jsx: "automatic",
    jsxDev: options.mode !== "production",
    plugins,
  };
};

async function writeServerBuildResult(
  config: RemixConfig,
  serverBuildPath: string,
  outputFiles: esbuild.OutputFile[]
) {
  await fse.ensureDir(path.dirname(serverBuildPath));

  for (let file of outputFiles) {
    if (file.path.endsWith(".js")) {
      // fix sourceMappingURL to be relative to current path instead of /build
      let filename = file.path.substring(file.path.lastIndexOf(path.sep) + 1);
      let escapedFilename = filename.replace(/\./g, "\\.");
      let pattern = `(//# sourceMappingURL=)(.*)${escapedFilename}`;
      let contents = Buffer.from(file.contents).toString("utf-8");
      contents = contents.replace(new RegExp(pattern), `$1${filename}`);
      await fse.writeFile(file.path, contents);
    } else if (file.path.endsWith(".map")) {
      // Don't write CSS source maps to server build output
      if (file.path.endsWith(".css.map")) {
        break;
      }

      // remove route: prefix from source filenames so breakpoints work
      let contents = Buffer.from(file.contents).toString("utf-8");
      contents = contents.replace(/"route:/gm, '"');
      await fse.writeFile(file.path, contents);
    } else {
      let assetPath = path.join(
        config.assetsBuildDirectory,
        file.path.replace(path.dirname(serverBuildPath), "")
      );

      // Don't write CSS bundle from server build to browser assets directory,
      // especially since the file name doesn't contain a content hash
      if (assetPath === path.join(config.assetsBuildDirectory, "index.css")) {
        break;
      }

      await fse.ensureDir(path.dirname(assetPath));
      await fse.writeFile(assetPath, file.contents);
    }
  }
}

export const createServerCompiler = (
  remixConfig: RemixConfig,
  options: CompileOptions
): ServerCompiler => {
  let compile = async (
    manifestChannel: ReadChannel<AssetsManifest>,
    outfile = remixConfig.serverBuildPath,
    routes = remixConfig.routes
  ) => {
    let esbuildConfig = createEsbuildConfig(
      remixConfig,
      manifestChannel,
      outfile,
      routes,
      options
    );
    let { metafile, outputFiles } = await esbuild.build({
      ...esbuildConfig,
      write: false,
      metafile: true,
    });
    invariant(metafile, "Expected metafile to be defined.");
    await writeServerBuildResult(remixConfig, outfile, outputFiles!);
    return metafile;
  };

  let compileBundles = (manifestChannel: ReadChannel<AssetsManifest>) => {
    if (remixConfig.serverBundles) {
      return remixConfig.serverBundles.map(({ serverBuildPath, routes }) =>
        compile(manifestChannel, serverBuildPath, routes)
      );
    }
    return [compile(manifestChannel)];
  };

  return {
    compile,
    compileBundles,
    dispose: () => undefined,
  };
};

function isNotNull<Value>(value: Value): value is Exclude<Value, null> {
  return value !== null;
}
