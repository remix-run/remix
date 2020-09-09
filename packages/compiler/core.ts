import fs from "fs";
import path from "path";
import * as rollup from "rollup";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

import { enableHmr, watchInput, npmChunks } from "./rollupPlugins";
import { readVendorFile } from "./utils";

const hmrClientCode = readVendorFile("esm-hmr/client.js");

export type CompilerInput = { [entryAlias: string]: string };
export type CompilerMode = "production" | "development";

export interface CompilerOptions {
  flattenWaterfall: boolean;
  mode: CompilerMode;
  outputDir: string;
  sourceDir: string;
}

function getInput(sourceDir: string): CompilerInput {
  let input = Object.create(null);

  fs.readdirSync(sourceDir).forEach(file => {
    let entryAlias = `_src/${path.basename(file, path.extname(file))}`;
    input[entryAlias] = path.resolve(sourceDir, file);
  });

  return input;
}

/**
 * Runs the compiler once.
 */
export async function build({
  flattenWaterfall = false,
  mode = "production",
  outputDir = "./build",
  sourceDir = "./src"
}: Partial<CompilerOptions> = {}) {
  let build = await rollup.rollup({
    input: getInput(sourceDir),
    plugins: [
      replace({
        "process.env.NODE_ENV": JSON.stringify(
          mode === "production" ? "production" : "development"
        )
      }),
      // TODO: Provide the ability to group multiple libraries
      // into the same chunk somehow.
      npmChunks({
        getChunkName: id => `_npm/${id}`
      }),
      nodeResolve({
        mainFields: ["module", "main"]
      }),
      commonjs()
    ]
  });

  await build.generate({
    dir: outputDir,
    hoistTransitiveImports: flattenWaterfall,
    format: "esm"
  });
}

/**
 * Starts the compiler in watch mode and triggers the given callback whenever
 * the build output changes.
 */
export function watch(
  {
    mode = "development",
    outputDir,
    sourceDir = "./src"
  }: Partial<CompilerOptions> = {},
  callback: (event: rollup.RollupWatcherEvent) => void
) {
  let plugins: rollup.Plugin[] = [
    replace({
      "process.env.NODE_ENV": JSON.stringify(
        mode === "production" ? "production" : "development"
      )
    }),
    npmChunks({
      getChunkName: id => `_npm/${id}`
    }),
    watchInput({
      watchFile: sourceDir,
      getInput() {
        return getInput(sourceDir);
      }
    })
  ];

  if (mode === "development") {
    plugins.push(
      enableHmr({
        fileName: "_hmr/client.js",
        hmrClientCode: hmrClientCode,
        // We'd prefer to be able to just do this, but there's a bug with
        // include/exclude in Rollup's pluginutils. See
        // https://github.com/rollup/plugins/issues/490#issuecomment-664050318
        // include: path.join(sourceDir, "**", "*.js")
        include: path.join(path.relative(process.cwd(), sourceDir), "**", "*")
      })
    );
  }

  plugins.push(
    nodeResolve({
      mainFields: ["module", "main"]
    }),
    commonjs()
  );

  let options: rollup.RollupOptions = {
    plugins: plugins,
    watch: {
      skipWrite: outputDir == null
    }
  };

  if (outputDir != null) {
    options.output = {
      dir: outputDir,
      format: "esm"
    };
  }

  let watcher = rollup.watch(options);

  if (callback) {
    watcher.on("event", callback);
  }

  return () => {
    watcher.close();
  };
}
