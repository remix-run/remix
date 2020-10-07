import { promises as fsp } from "fs";
import path from "path";
import type {
  ExternalOption,
  InputOption,
  RollupBuild,
  RollupError,
  RollupOutput,
  OutputOptions,
  Plugin
} from "rollup";
import * as rollup from "rollup";
import alias from "@rollup/plugin-alias";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

import { AssetManifestFilename, ServerManifestFilename } from "./build";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import type { ConfigRouteObject } from "./routes";
import { purgeRequireCache } from "./requireCache";

import manifest from "./rollup/manifest";
import watchInput from "./rollup/watchInput";
import mdxTransform from "./rollup/mdx";

export enum BuildMode {
  Development = "development",
  Production = "production"
}

export enum BuildTarget {
  Browser = "browser",
  Server = "server"
}

/**
 * A Rollup build with our build options attached.
 */
export interface RemixBuild extends RollupBuild {
  options: {
    mode: BuildMode;
    target: BuildTarget;
  };
}

/**
 * Runs the build.
 */
export async function build(
  config: RemixConfig,
  {
    mode = BuildMode.Production,
    target = BuildTarget.Server
  }: { mode?: BuildMode; target?: BuildTarget } = {}
): Promise<RemixBuild> {
  let rollupBuild = await rollup.rollup({
    external: getExternalOption(target),
    input: getInputOption(config, target),
    plugins: getCommonPlugins(config, mode, target)
  });

  return {
    ...rollupBuild,
    options: { mode, target }
  };
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
    onBuildEnd?: (build: RemixBuild) => void;
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
      if (onBuildEnd) {
        let rollupBuild = event.result;
        onBuildEnd({
          ...rollupBuild,
          options: { mode, target }
        });
      }
    }
  });

  return () => {
    watcher.close();
  };
}

/**
 * Creates an in-memory build. This is useful in both the asset server and the
 * main server in dev mode to avoid writing the builds to disk.
 */
export function generate(build: RemixBuild): Promise<RollupOutput> {
  let { target } = build.options;

  let options: OutputOptions = {
    format: target === BuildTarget.Server ? "cjs" : "esm",
    exports: target === BuildTarget.Server ? "named" : undefined
  };

  return build.generate(options);
}

/**
 * Writes the build to disk.
 */
export function write(
  build: RemixBuild,
  config: RemixConfig
): Promise<RollupOutput> {
  let { target } = build.options;

  let options: OutputOptions = {
    dir:
      target === BuildTarget.Server
        ? config.serverBuildDirectory
        : config.browserBuildDirectory,
    format: target === BuildTarget.Server ? "cjs" : "esm",
    exports: target === BuildTarget.Server ? "named" : undefined
  };

  return build.write(options);
}

/**
 * Runs the server build in dev as requests come in.
 */
export async function generateDevServerBuild(
  config: RemixConfig
): Promise<RollupOutput> {
  let serverBuild = await build(config, {
    mode: BuildMode.Development,
    target: BuildTarget.Server
  });

  return generate(serverBuild);
}

////////////////////////////////////////////////////////////////////////////////

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
  appDirectory: string,
  routesConfig: RemixConfig["routes"],
  input: Input = {}
): Input {
  for (let route of routesConfig) {
    input[route.id] = path.resolve(appDirectory, route.componentFile);

    if (route.children) {
      getInputForRoutes(appDirectory, route.children, input);
    }
  }

  return input;
}

function getInputOption(config: RemixConfig, target: BuildTarget): InputOption {
  let input = getInputForRoutes(config.appDirectory, config.routes);

  if (target === BuildTarget.Server) {
    input["entry-server"] = path.resolve(config.appDirectory, "entry-server");
  } else {
    input["entry-browser"] = path.resolve(config.appDirectory, "entry-browser");
  }

  return input;
}

async function visitRoutes(
  routes: RemixConfig["routes"],
  callback: (route: ConfigRouteObject) => Promise<void>
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
          path.join(config.appDirectory, "global.css"),
          "utf-8"
        )
      });

      await visitRoutes(config.routes, async route => {
        if (route.stylesFile) {
          this.emitFile({
            type: "asset",
            name: `style/${route.id}.css`,
            source: await fsp.readFile(
              path.join(config.appDirectory, route.stylesFile),
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
    mdxTransform(config.mdx),
    babel({
      babelHelpers:
        mode === BuildMode.Development && target === BuildTarget.Server
          ? // Everything needs to be inlined into the server bundles in
            // development since they are served directly out of the build
            // in memory instead of from on disk, so there is no way they
            // can require() something else from the build.
            "inline"
          : "bundled",
      configFile: false,
      exclude: /node_modules/,
      extensions: [".js", ".ts", ".tsx", ".md", ".mdx"],
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
          ? AssetManifestFilename
          : ServerManifestFilename
    })
  );

  return plugins;
}
