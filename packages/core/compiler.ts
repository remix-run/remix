import { promises as fsp } from "fs";
import path from "path";
import type {
  ExternalOption,
  InputOption,
  RollupBuild,
  RollupError,
  RollupOutput,
  Plugin
} from "rollup";
import * as rollup from "rollup";
import alias from "@rollup/plugin-alias";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

import { BrowserManifestFilename, ServerManifestFilename } from "./build";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import type { RemixRouteObject } from "./routes";
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
    input[route.id] = path.resolve(sourceDirectory, route.componentFile);

    if (route.children) {
      getInputForRoutes(sourceDirectory, route.children, input);
    }
  }

  return input;
}

function getInputOption(config: RemixConfig, target: BuildTarget): InputOption {
  let input = getInputForRoutes(config.sourceDirectory, config.routes);

  if (target === BuildTarget.Server) {
    input["entry-server"] = path.resolve(
      config.sourceDirectory,
      "entry-server"
    );
  } else {
    input["entry-browser"] = path.resolve(
      config.sourceDirectory,
      "entry-browser"
    );
  }

  return input;
}

async function visitRoutes(
  routes: RemixConfig["routes"],
  callback: (route: RemixRouteObject) => Promise<void>
): Promise<void> {
  for (let route of routes) {
    await callback(route);

    if (route.children) {
      await visitRoutes(route.children, callback);
    }
  }
}

function postcss(config: RemixConfig): Plugin {
  return {
    name: "postcss",
    // load(id: string) {
    //   // ...
    // },
    // transform() {
    //   // postcss
    // },
    async generateBundle() {
      this.emitFile({
        type: "asset",
        name: "global.css",
        source: await fsp.readFile(
          path.join(config.sourceDirectory, "global.css"),
          "utf-8"
        )
      });

      await visitRoutes(config.routes, async route => {
        if (route.stylesFile) {
          this.emitFile({
            type: "asset",
            name: `style/${route.id}.css`,
            source: await fsp.readFile(
              path.join(config.stylesDirectory, route.stylesFile),
              "utf-8"
            )
          });
        }
      });
    }
  };
}

function getCommonPlugins(
  config: RemixConfig,
  mode: BuildMode,
  target: BuildTarget
): Plugin[] {
  let plugins: Plugin[] = [];

  if (target === BuildTarget.Browser) {
    plugins.push(
      alias({
        entries: [
          {
            // entry-browser.js imports @remix-run/react/browser
            // src/components/App.js imports @remix-run/react
            find: "@remix-run/react",
            replacement: path.resolve(
              config.rootDirectory,
              "node_modules/@remix-run/react/esm"
            )
          }
        ]
      })
    );
  }

  plugins.push(
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
    postcss(config),
    replace({
      "process.env.NODE_ENV": JSON.stringify(mode)
    }),
    manifest({
      outputDir: config.serverBuildDirectory,
      fileName:
        target === BuildTarget.Browser
          ? BrowserManifestFilename
          : ServerManifestFilename
    })
  );

  return plugins;
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
 * Runs the server build in dev as requests come in. At this point, the config
 * object has been trimmed down to contain only the routes matched in the
 * request, which should speed up the build considerably.
 */
export async function generateDevServerBuild(
  config: RemixConfig
): Promise<RollupOutput> {
  let serverBuild = await build(config, {
    mode: BuildMode.Development,
    target: BuildTarget.Server
  });

  return serverBuild.generate({
    format: "cjs",
    exports: "named"
  });
}

/**
 * Runs the build in watch mode.
 */
export function watch(
  config: RemixConfig,
  {
    mode = BuildMode.Development,
    target = BuildTarget.Browser,
    onBuildStart,
    onBuildEnd,
    onError
  }: {
    mode?: BuildMode;
    target?: BuildTarget;
    onBuildStart?: () => void;
    onBuildEnd?: (build: RollupBuild) => void;
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
      if (onError) {
        onError(event.error);
      } else {
        console.error(event.error);
      }
    } else if (event.code === "BUNDLE_START") {
      if (onBuildStart) onBuildStart();
    } else if (event.code === "BUNDLE_END") {
      if (onBuildEnd) onBuildEnd(event.result);
    }
  });

  return () => {
    watcher.close();
  };
}
