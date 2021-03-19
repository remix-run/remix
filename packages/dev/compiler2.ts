import { builtinModules as nodeBuiltins } from "module";
import * as esbuild from "esbuild";
import * as path from "path";
// import chokidar from "chokidar";

import { BuildMode, BuildTarget } from "./build";
import type { RemixConfig } from "./config";
import { createAssetsManifest } from "./compiler2/assets";
import { browserEntryPointsPlugin } from "./compiler2/client";
import { getServerEntryPointModule } from "./compiler2/server";
import { getAppDependencies } from "./compiler2/dependencies";
import { writeFileSafe } from "./compiler2/utils/fs";
import { loaders } from "./compiler2/loaders";

// When we build Remix, this shim file is copied directly into the output
// directory in the same place relative to this file. It is eventually injected
// as a source file when building the app.
const reactShim = path.resolve(__dirname, "compiler2/shims/react.ts");

interface BuildOptions {
  mode: BuildMode;
  target: BuildTarget;
}

export async function build(
  config: RemixConfig,
  {
    mode = BuildMode.Production,
    target = BuildTarget.Node14
  }: Partial<BuildOptions> = {}
): Promise<void> {
  await buildEverything(config, { mode, target });
}

interface WatchOptions extends BuildOptions {
  onRebuild({ ms }: { ms: number }): void;
}

export async function watch(
  config: RemixConfig,
  {
    mode = BuildMode.Development,
    target = BuildTarget.Node14,
    onRebuild
  }: Partial<WatchOptions> = {}
) {
  let watchBrowser: esbuild.WatchMode = {
    onRebuild(error, result) {
      if (error) {
        console.error(error);
      } else {
        console.log(result);
      }
    }
  };

  let watchServer: esbuild.WatchMode = {
    onRebuild(error, result) {
      if (error) {
        console.error(error);
      } else {
        console.log(result);
      }
    }
  };

  let [browserBuild, serverBuild] = await buildEverything(
    config,
    { mode, target },
    watchBrowser,
    watchServer
  );

  // async function rebuildEverything() {
  //   let start = Date.now();

  //   await Promise.all([browserBuild.rebuild!(), serverBuild.rebuild!()]);

  //   if (onRebuild) {
  //     onRebuild({ ms: Date.now() - start });
  //   }
  // }

  // TODO: Add an empty file
  // let watcher = chokidar
  //   .watch(config.appDirectory, {
  //     persistent: true,
  //     awaitWriteFinish: {
  //       stabilityThreshold: 100,
  //       pollInterval: 100
  //     }
  //   })
  //   .on("error", error => console.error(error))
  //   .on("change", async file => {
  //     let appFile = path.relative(config.appDirectory, file);
  //     let routeId = Object.keys(config.routeManifest).find(
  //       key => config.routeManifest[key].moduleFile === appFile
  //     );
  //     if (routeId) {
  //       await rebuildRoute(routeId);
  //     } else {
  //       await rebuildEverything();
  //     }
  //   });

  // let exports = getAllRoutesExports();
  // let builder = await buildEverything(exports);

  // onRouteModuleChange(async routeModule => {
  //   let newExports = await getRouteExports(routeModule);
  //   await builder.rebuildFromRouteChange(newExports);
  //   onRebuild()
  // });

  // onRandomFileChange(async () => {
  //   await builder.rebuild();
  //   onRebuild()
  // });

  // onRouteModuleAddedOrDeleted(() => {
  //   await builder.reset();
  //   let exports = getAllRoutesExports();
  //   builder = buildEverything()
  //   onRebuild()
  // });

  // when the server first boots:
  // - get all routes' exports
  // - build client/assets/server

  // when a route module changes:
  // - get its exports
  // - rebuild client/assets/server

  // when anything else changes:
  // - rebuild client/assets/server

  // when route module is added/deleted:
  // - dispose + setup

  return async () => {
    // await watcher.close();
    await Promise.all([
      browserBuild.rebuild?.dispose(),
      serverBuild.rebuild?.dispose()
    ]);
  };
}

///////////////////////////////////////////////////////////////////////////////

async function buildEverything(
  config: RemixConfig,
  options: BuildOptions,
  watchBrowser: esbuild.BuildOptions["watch"] = false,
  watchServer: esbuild.BuildOptions["watch"] = false
): Promise<esbuild.BuildResult[]> {
  let appDeps = Object.keys(await getAppDependencies(config));

  // For the browser build, exclude node built-ins that don't have a
  // browser-safe alternative installed. Nothing should *actually* be external
  // in the browser build (we want to bundle all deps) so this is really just
  // making sure we don't accidentally have any dependencies on node built-ins
  // in browser bundles.
  let browserExternals = nodeBuiltins.filter(mod => !appDeps.includes(mod));

  let serverExternals: string[];
  switch (options.target) {
    case BuildTarget.Node14:
      serverExternals = nodeBuiltins.concat(appDeps);
      break;

    default:
      throw new Error(`Unknown build target: ${options.target}`);
  }

  return Promise.all([
    esbuild
      .build({
        entryPoints: [
          config.entryClientFile + "?browser",
          ...Object.keys(config.routeManifest).map(
            key =>
              path.resolve(
                config.appDirectory,
                config.routeManifest[key].moduleFile
              ) + "?browser"
          )
        ],
        entryNames: "[dir]/[name]-[hash]",
        outdir: config.assetsBuildDirectory,
        format: "esm",
        bundle: true,
        splitting: true,
        metafile: true,
        minify: options.mode === BuildMode.Production,
        loader: loaders,
        publicPath: config.publicPath,
        external: browserExternals,
        inject: [reactShim],
        watch: watchBrowser,
        define: {
          "process.env.NODE_ENV": JSON.stringify(options.mode)
        },
        plugins: [browserEntryPointsPlugin(config, options)]
      })
      .then(async clientBuild => {
        let assetsManifest = await createAssetsManifest(
          config,
          options,
          clientBuild.metafile!
        );

        let filename = `manifest-${assetsManifest.version}.js`;
        assetsManifest.url = config.publicPath + filename;
        await Promise.all([
          writeFileSafe(
            path.join(config.assetsBuildDirectory, filename),
            `window.__remixManifest=${JSON.stringify(assetsManifest)}`
          ),
          writeFileSafe(
            path.join(config.serverBuildDirectory, "assets.json"),
            JSON.stringify(assetsManifest, null, 2)
          )
        ]);

        return clientBuild;
      }),
    esbuild.build({
      stdin: {
        contents: getServerEntryPointModule(config, options, "./assets.json"),
        sourcefile: "index.js",
        resolveDir: "/"
      },
      outfile: path.resolve(config.serverBuildDirectory, "index.js"),
      format: "cjs",
      platform: "node",
      target: options.target,
      loader: loaders,
      publicPath: config.publicPath,
      external: serverExternals,
      inject: [reactShim],
      bundle: true,
      watch: watchServer,
      plugins: [
        {
          name: "ignore-assets-json",
          setup(build) {
            build.onResolve({ filter: /assets\.json$/ }, args => {
              return { path: args.path, external: true };
            });
          }
        }
      ]
    })
  ]);
}
