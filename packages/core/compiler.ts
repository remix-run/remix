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
import { terser } from "rollup-plugin-terser";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

import { AssetManifestFilename, ServerManifestFilename } from "./build";
import type { RemixConfig } from "./config";
import { readConfig } from "./config";
import { purgeRequireCache } from "./requireCache";

import manifest from "./rollup/manifest";
import watchInput from "./rollup/watchInput";
import watchStyles from "./rollup/watchStyles";
import mdxTransform from "./rollup/mdx";
import styles from "./rollup/styles";

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
  options: BuildOptions;
}

function createBuild(build: RollupBuild, options: BuildOptions): RemixBuild {
  let remixBuild = (build as unknown) as RemixBuild;
  remixBuild.options = options;
  return remixBuild;
}

export interface BuildOptions {
  mode: BuildMode;
  target: BuildTarget;
  manifestDir?: string;
}

/**
 * Runs the build.
 */
export async function build(
  config: RemixConfig,
  {
    mode = BuildMode.Production,
    target = BuildTarget.Server,
    manifestDir
  }: Partial<BuildOptions> = {}
): Promise<RemixBuild> {
  let plugins: Plugin[] = [];

  if (target === BuildTarget.Browser) {
    plugins.push(styles({ sourceDir: config.appDirectory }));
  }

  plugins.push(...getBuildPlugins(config, mode, target, manifestDir));

  let rollupBuild = await rollup.rollup({
    external: getExternalOption(target),
    input: getInputOption(config, target),
    plugins
  });

  return createBuild(rollupBuild, { mode, target });
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
    onBuildStart,
    onBuildEnd,
    onError
  }: Partial<WatchOptions> = {}
): () => void {
  let watcher = rollup.watch({
    external: getExternalOption(target),
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
      ...getBuildPlugins(config, mode, target, manifestDir)
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
        onBuildEnd(createBuild(event.result, { mode, target }));
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
  dir: string
): Promise<RollupOutput> {
  return write(
    await build(config, {
      mode: BuildMode.Development,
      target: BuildTarget.Server,
      manifestDir: dir
    }),
    dir
  );
}

////////////////////////////////////////////////////////////////////////////////

function isLocalModuleId(id: string): boolean {
  return (
    // This is a relative id that hasn't been resolved yet, e.g. "./App"
    id.startsWith(".") ||
    // This is an absolute filesystem path that has already been resolved, e.g.
    // "/path/to/node_modules/react/index.js"
    (process.platform === "win32" ? /^[A-Z]:\//.test(id) : id.startsWith("/"))
  );
}

function getExternalOption(target: BuildTarget): ExternalOption | undefined {
  return target === BuildTarget.Server
    ? // Exclude non-local module identifiers from the server bundles.
      // This includes identifiers like "react" which will be resolved
      // dynamically at runtime using require().
      (id: string) => !isLocalModuleId(id)
    : undefined;
}

function getInputOption(config: RemixConfig, target: BuildTarget): InputOption {
  let input: { [entryName: string]: string } = {};

  if (target === BuildTarget.Browser) {
    input["entry-browser"] = path.resolve(config.appDirectory, "entry-browser");
  } else if (target === BuildTarget.Server) {
    input["entry-server"] = path.resolve(config.appDirectory, "entry-server");
  }

  for (let key in config.routeManifest) {
    let route = config.routeManifest[key];
    input[route.id] = path.resolve(config.appDirectory, route.componentFile);
  }

  return input;
}

function getBuildPlugins(
  config: RemixConfig,
  mode: BuildMode,
  target: BuildTarget,
  manifestDir?: string
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
    mdxTransform(config.mdx),
    babel({
      babelHelpers: "bundled",
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
    replace({
      "process.env.NODE_ENV": JSON.stringify(mode)
    })
  );

  if (mode === BuildMode.Production) {
    plugins.push(terser());
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
      mode === BuildMode.Production ? "[name]-[hash].js" : "[name].js",
    manualChunks(id: string) {
      let pieces = id.split(path.sep);
      let index = pieces.lastIndexOf("node_modules");

      if (index !== -1 && pieces.length > index + 1) {
        let packageName = pieces[index + 1];

        if (packageName.startsWith("@") && pieces.length > index + 2) {
          packageName += "/" + pieces[index + 2];
        }

        return "node_modules/" + packageName;
      }

      return undefined;
    }
  };
}
