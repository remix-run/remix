import path from "path";
import type {
  ExternalOption,
  InputOption,
  InputOptions,
  OutputOptions,
  Plugin,
  RollupError,
  RollupOutput,
  TreeshakingOptions
} from "rollup";
import * as rollup from "rollup";
import alias from "@rollup/plugin-alias";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { terser } from "rollup-plugin-terser";

import { ignorePackages } from "./browserIgnore";
import type { BuildOptions, RemixBuild } from "./build";
import { BuildMode, BuildTarget, createBuild } from "./build";
import { AssetManifestFilename, ServerManifestFilename } from "./buildManifest";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import { purgeRequireCache } from "./requireCache";

import manifest from "./rollup/manifest";
import watchInput from "./rollup/watchInput";
import watchStyles from "./rollup/watchStyles";
import mdx from "./rollup/mdx";
import routeModules from "./rollup/routeModules";
import styles from "./rollup/styles";

/**
 * Runs the build.
 */
export async function build(
  config: RemixConfig,
  {
    mode = BuildMode.Production,
    target = BuildTarget.Server,
    manifestDir,
    routeModuleFiles
  }: Partial<BuildOptions> = {}
): Promise<RemixBuild> {
  let buildOptions = {
    mode,
    target,
    manifestDir,
    routeModuleFiles
  };

  let plugins: Plugin[] = [];

  if (target === BuildTarget.Browser) {
    plugins.push(styles({ sourceDir: config.appDirectory }));
  }

  plugins.push(...getBuildPlugins(config, buildOptions));

  let rollupBuild = await rollup.rollup({
    external: getExternalOption(target),
    input: getInputOption(config, target),
    treeshake: getTreeshakeOption(target),
    onwarn: getOnWarnOption(target),
    plugins
  });

  return createBuild(rollupBuild, buildOptions);
}

export interface WatchOptions extends BuildOptions {
  onBuildStart: () => void;
  onBuildEnd: (build: RemixBuild) => void;
  onError: (error: RollupError) => void;
}

/**
 * Runs the build in watch mode.
 */
export function watch(
  config: RemixConfig,
  {
    mode = BuildMode.Development,
    target = BuildTarget.Browser,
    manifestDir,
    routeModuleFiles,
    onBuildStart,
    onBuildEnd,
    onError
  }: Partial<WatchOptions> = {}
): () => void {
  let buildOptions = {
    mode,
    target,
    manifestDir,
    routeModuleFiles
  };

  let watcher = rollup.watch({
    external: getExternalOption(target),
    treeshake: getTreeshakeOption(target),
    onwarn: getOnWarnOption(target),
    plugins: [
      watchInput({
        sourceDir: config.rootDirectory,
        async getInput() {
          purgeRequireCache(config.rootDirectory);
          config = await readConfig(config.rootDirectory);
          return getInputOption(config, target);
        }
      }),
      watchStyles({
        sourceDir: config.appDirectory
      }),
      ...getBuildPlugins(config, buildOptions)
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
        onBuildEnd(createBuild(event.result, buildOptions));
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
  return build.generate(getCommonOutputOptions(build));
}

/**
 * Writes the build to disk.
 */
export function write(build: RemixBuild, dir: string): Promise<RollupOutput> {
  return build.write({ ...getCommonOutputOptions(build), dir });
}

/**
 * Runs the server build in dev as requests come in.
 */
export async function writeDevServerBuild(
  config: RemixConfig,
  outputDir: string,
  routeModuleFiles?: BuildOptions["routeModuleFiles"]
): Promise<RollupOutput> {
  return write(
    await build(config, {
      mode: BuildMode.Development,
      target: BuildTarget.Server,
      manifestDir: outputDir,
      routeModuleFiles
    }),
    outputDir
  );
}

////////////////////////////////////////////////////////////////////////////////

function isLocalModuleId(id: string): boolean {
  return (
    // This is a relative id that hasn't been resolved yet, e.g. "./App"
    id.startsWith(".") ||
    // This is an absolute filesystem path that has already been resolved, e.g.
    // "/path/to/node_modules/react/index.js"
    path.isAbsolute(id)
  );
}

function getExternalOption(target: BuildTarget): ExternalOption | undefined {
  return target === BuildTarget.Server
    ? // Exclude non-local module identifiers from the server bundles.
      // This includes identifiers like "react" which will be resolved
      // dynamically at runtime using require().
      (id: string) => !isLocalModuleId(id)
    : // Exclude packages we know we don't want in the browser bundles.
      // These *should* be stripped from the browser bundles anyway when
      // tree-shaking kicks in, so making them external just saves Rollup
      // some time having to load and parse them and their dependencies.
      ignorePackages;
}

function getInputOption(config: RemixConfig, target: BuildTarget): InputOption {
  let input: InputOption = {};

  if (target === BuildTarget.Browser) {
    input["entry-browser"] = path.resolve(config.appDirectory, "entry-browser");
  } else if (target === BuildTarget.Server) {
    input["entry-server"] = path.resolve(config.appDirectory, "entry-server");
  }

  // TODO: Make this optional if there is no global-data.js file
  input["global-data"] = path.resolve(config.appDirectory, "global-data");

  return input;
}

function getTreeshakeOption(
  target: BuildTarget
): TreeshakingOptions | undefined {
  if (target === BuildTarget.Browser) {
    // When building for the browser, we need to be very aggressive with
    // code removal so we can be sure all imports of server-only code are
    // removed.
    return {
      // Assume modules do not have side-effects.
      moduleSideEffects: false,
      // Assume reading a property of an object never has side-effects.
      propertyReadSideEffects: false
    };
  }

  return undefined;
}

function getOnWarnOption(
  target: BuildTarget
): InputOptions["onwarn"] | undefined {
  if (target === BuildTarget.Browser) {
    return (warning, warn) => {
      if (warning.code === "EMPTY_BUNDLE") {
        // Ignore "Generated an empty chunk: blah" warnings when building for
        // the browser. There may be quite a few of them because we are
        // aggressively removing server-only packages from the build.
        // TODO: Can we get Rollup to avoid generating these chunks entirely?
        return;
      }

      warn(warning);
    };
  }

  return undefined;
}

function getBuildPlugins(
  config: RemixConfig,
  {
    mode,
    target,
    manifestDir,
    routeModuleFiles = getRouteModuleFiles(config)
  }: BuildOptions
): Plugin[] {
  let plugins: Plugin[] = [];

  if (target === BuildTarget.Browser) {
    plugins.push(
      alias({
        entries: [
          {
            find: "@remix-run/react",
            replacement: "@remix-run/react/esm"
          }
        ]
      })
    );
  }

  plugins.push(
    mdx({
      mdxConfig: config.mdx
    }),
    routeModules({
      routeModuleFiles,
      target
    }),
    json(),
    babel({
      babelHelpers: "bundled",
      configFile: false,
      exclude: /node_modules/,
      extensions: [".js", ".jsx", ".ts", ".tsx", ".md", ".mdx"],
      presets: [
        ["@babel/preset-react", { runtime: "automatic" }],
        ["@babel/preset-env", { bugfixes: true, targets: { node: "12" } }],
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
      browser: target === BuildTarget.Browser,
      extensions: [".js", ".json", ".ts", ".tsx"],
      preferBuiltins: target !== BuildTarget.Browser
    }),
    commonjs(),
    replace({
      "process.env.NODE_ENV": JSON.stringify(mode)
    })
  );

  if (mode === BuildMode.Production) {
    plugins.push(
      terser({
        ecma: 2017
      })
    );
  }

  plugins.push(
    manifest({
      outputDir: manifestDir,
      fileName:
        target === BuildTarget.Browser
          ? AssetManifestFilename
          : ServerManifestFilename
    })
  );

  return plugins;
}

function getRouteModuleFiles(config: RemixConfig) {
  let routeManifest = config.routeManifest;
  let routeIds = Object.keys(routeManifest);

  return routeIds.reduce((memo, routeId) => {
    let route = routeManifest[routeId];
    if (route.moduleFile)
      memo[route.id] = path.resolve(config.appDirectory, route.moduleFile);
    return memo;
  }, {} as { [routeId: string]: string });
}

function getCommonOutputOptions(build: RemixBuild): OutputOptions {
  let { mode, target } = build.options;

  return {
    format: target === BuildTarget.Server ? "cjs" : "esm",
    exports: target === BuildTarget.Server ? "named" : undefined,
    assetFileNames:
      mode === BuildMode.Production
        ? "[name]-[hash][extname]"
        : "[name][extname]",
    chunkFileNames: "_shared/[name]-[hash].js",
    entryFileNames:
      mode === BuildMode.Production && target === BuildTarget.Browser
        ? "[name]-[hash].js"
        : "[name].js",
    manualChunks(id) {
      return getNpmPackageName(id);
    }
  };
}

function getNpmPackageName(id: string): string | undefined {
  let pieces = id.split(path.sep);
  let index = pieces.lastIndexOf("node_modules");

  if (index !== -1 && pieces.length > index + 1) {
    let packageName = pieces[index + 1];

    if (packageName.startsWith("@") && pieces.length > index + 2) {
      packageName =
        // S3 hates @folder, so we switch it to __
        packageName.replace("@", "__") + "/" + pieces[index + 2];
    }

    return packageName;
  }

  return undefined;
}
