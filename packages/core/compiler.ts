import path from "path";
import type {
  ExternalOption,
  InputOption,
  RollupBuild,
  RollupError,
  Plugin
} from "rollup";
import * as rollup from "rollup";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

import {
  ManifestBrowserEntryKey,
  ManifestServerEntryKey,
  BrowserManifestFilename,
  ServerManifestFilename
} from "./build";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import { purgeRequireCache } from "./requireCache";

import manifest from "./rollup/manifest";
import watchInput from "./rollup/watchInput";

export enum BuildMode {
  Development = "development",
  Production = "production"
}

export enum BuildTarget {
  Browser = "browser",
  Server = "server"
}

function getExternalOption(target: BuildTarget): ExternalOption | undefined {
  return target === BuildTarget.Server
    ? // Ignore node_modules, bare identifiers, etc.
      (id: string) => !(id.startsWith("/") || id.startsWith("."))
    : // Bundle everything.
      undefined;
}

interface Input {
  [entryName: string]: string;
}

function getInputForRoutes(
  sourceDirectory: string,
  routesConfig: RemixConfig["routes"],
  input: Input = {}
): Input {
  for (let route of routesConfig) {
    input[route.id] = path.resolve(sourceDirectory, route.component);
    if (route.children) {
      getInputForRoutes(sourceDirectory, route.children, input);
    }
  }

  return input;
}

function getInputOption(config: RemixConfig, target: BuildTarget): InputOption {
  let input = getInputForRoutes(config.sourceDirectory, config.routes);

  if (target === BuildTarget.Server) {
    input[ManifestServerEntryKey] = path.join(
      config.sourceDirectory,
      "entry-server"
    );
  } else {
    input[ManifestBrowserEntryKey] = path.join(
      config.sourceDirectory,
      "entry-browser"
    );
  }

  return input;
}

function getCommonPlugins(
  config: RemixConfig,
  mode: BuildMode,
  target: BuildTarget
): Plugin[] {
  return [
    babel({
      babelHelpers: "bundled",
      configFile: false,
      exclude: /node_modules/,
      extensions: [".js", ".ts", ".tsx"],
      presets: [
        "@babel/preset-react",
        ["@babel/preset-env", { targets: { node: "12" } }],
        [
          "@babel/preset-typescript",
          {
            allExtensions: true,
            isTSX: true
          }
        ]
      ]
    }),
    nodeResolve({
      extensions: [".js", ".json", ".ts", ".tsx"]
    }),
    commonjs(),
    replace({
      "process.env.NODE_ENV": JSON.stringify(mode)
    }),
    manifest({
      outputDir: config.serverBuildDirectory,
      filename:
        target === BuildTarget.Browser
          ? BrowserManifestFilename
          : ServerManifestFilename
    })
  ];
}

/**
 * Runs the build.
 */
export function build(
  config: RemixConfig,
  {
    mode = BuildMode.Production,
    target = BuildTarget.Server
  }: { mode?: BuildMode; target?: BuildTarget } = {}
): Promise<RollupBuild> {
  return rollup.rollup({
    external: getExternalOption(target),
    input: getInputOption(config, target),
    plugins: getCommonPlugins(config, mode, target)
  });
}

/**
 * Runs the build in watch mode.
 */
export function watch(
  config: RemixConfig,
  {
    mode = BuildMode.Development,
    target = BuildTarget.Server,
    onBuild,
    onError
  }: {
    mode?: BuildMode;
    target?: BuildTarget;
    onBuild?: (build: RollupBuild) => void;
    onError?: (error: RollupError) => void;
  } = {}
): () => void {
  let watcher = rollup.watch({
    external: getExternalOption(target),
    plugins: [
      watchInput({
        watchFile: config.rootDirectory,
        async getInput() {
          purgeRequireCache(config.rootDirectory);
          config = await readConfig(config.rootDirectory);
          return getInputOption(config, target);
        }
      }),
      ...getCommonPlugins(config, mode, target)
    ],
    watch: {
      // Skip the write here and do it in a callback instead. This gives us
      // a more consistent interface between `build` and `watch`. Both of them
      // give you access to the raw build and let you do the generate/write
      // step separately.
      skipWrite: true
    }
  });

  watcher.on("event", event => {
    if (event.code === "ERROR") {
      if (onError) onError(event.error);
    } else if (event.code === "BUNDLE_END") {
      if (onBuild) onBuild(event.result);
    }
  });

  return () => {
    watcher.close();
  };
}

// export async function watch(
//   remixRoot?: string,
//   onBuild?: (buildResult: BuildResult) => void
// ) {
//   let config = await readConfig(remixRoot);

//   let watchOptions: RollupWatchOptions = {
//     external(id) {
//       // Ignore node_modules, bare identifiers, etc.
//       return !(id.startsWith("/") || id.startsWith("."));
//     },
//     plugins: [
//       watchInput({
//         watchFile: config.rootDirectory,
//         async getInput() {
//           purgeRequireCache(config.rootDirectory);
//           config = await readConfig(config.rootDirectory);
//           return getInput(config);
//         }
//       }),
//       babel({
//         babelHelpers: "bundled",
//         configFile: false,
//         exclude: /node_modules/,
//         extensions: [".js", ".ts", ".tsx"],
//         presets: [
//           "@babel/preset-react",
//           ["@babel/preset-env", { targets: { node: "12" } }],
//           [
//             "@babel/preset-typescript",
//             {
//               allExtensions: true,
//               isTSX: true
//             }
//           ]
//         ]
//       }),
//       nodeResolve({
//         extensions: [".js", ".json", ".ts", ".tsx"]
//       }),
//       commonjs(),
//       replace({
//         "process.env.NODE_ENV": JSON.stringify(mode)
//       }),
//       manifest({
//         outputDir: config.serverBuildDirectory
//       })
//     ],
//     watch: {
//       // Skip the write here and do it in the `onBuild` callback instead. This
//       // gives us a more consistent interface between `build()` and `watch()`.
//       // Both of them give you access to the raw build and let you do the
//       // generate/write step separately.
//       skipWrite: true
//     }
//   };

//   let watcher = rollup.watch(watchOptions);

//   watcher.on("event", event => {
//     console.log({ event });

//     if (event.code === "BUNDLE_END") {
//       if (onBuild) {
//         onBuild({ remixConfig: config, build: event.result });
//       }
//     }
//   });

//   return watcher;
// }
