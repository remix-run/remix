import path from "path";
import type { InputOptions, RollupBuild, RollupWatchOptions } from "rollup";
import * as rollup from "rollup";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

import { ManifestServerEntryKey } from "./build";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import { purgeRequireCache } from "./require";

import manifest from "./rollup/manifest";
import watchInput from "./rollup/watchInput";

export enum BuildMode {
  Production = "production",
  Development = "development"
}

type Input = Record<string, string>;

function getInputForRoutes(
  sourceDirectory: string,
  routesConfig: RemixConfig["routes"],
  input: Input = {}
): Input {
  for (let route of routesConfig) {
    (input as { [key: string]: string })[route.id] = path.resolve(
      sourceDirectory,
      route.component
    );

    if (route.children) {
      getInputForRoutes(sourceDirectory, route.children, input);
    }
  }

  return input;
}

function createInput(config: RemixConfig): Input {
  let input = getInputForRoutes(config.sourceDirectory, config.routes);

  input[ManifestServerEntryKey] = path.join(
    config.sourceDirectory,
    "entry-server"
  );

  return input;
}

export interface BuildOptions {
  mode?: BuildMode;
  remixRoot?: string;
}

interface BuildResult {
  remixConfig: RemixConfig;
  build: RollupBuild;
}

export async function build({
  mode = BuildMode.Production,
  remixRoot
}: BuildOptions = {}): Promise<BuildResult> {
  let config = await readConfig(remixRoot);

  let serverProd: InputOptions = {
    input: createInput(config),
    external(id) {
      // Ignore node_modules, bare identifiers, etc.
      return !(id.startsWith("/") || id.startsWith("."));
    },
    plugins: [
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
        outputDir: config.serverBuildDirectory
      })
    ]
  };

  let build = await rollup.rollup(serverProd);

  return { build, remixConfig: config };
}

export interface WatchOptions extends BuildOptions {
  onBuild?: (buildResult: BuildResult) => void;
}

export async function watch({
  mode = BuildMode.Production,
  onBuild,
  remixRoot
}: WatchOptions = {}) {
  let config = await readConfig(remixRoot);

  let watchOptions: RollupWatchOptions = {
    external(id) {
      // Ignore node_modules, bare identifiers, etc.
      return !(id.startsWith("/") || id.startsWith("."));
    },
    plugins: [
      watchInput({
        watchFile: config.rootDirectory,
        async getInput() {
          purgeRequireCache(config.rootDirectory);
          config = await readConfig(config.rootDirectory);
          return createInput(config);
        }
      }),
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
        outputDir: config.serverBuildDirectory
      })
    ],
    watch: {
      skipWrite: true
    }
  };

  let watcher = rollup.watch(watchOptions);

  watcher.on("event", event => {
    console.log({ event });

    if (event.code === "BUNDLE_END") {
      if (onBuild) {
        onBuild({ remixConfig: config, build: event.result });
      }
    }
  });

  return watcher;
}
