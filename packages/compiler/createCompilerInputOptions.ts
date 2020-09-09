import path from "path";
import * as rollup from "rollup";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

import { enableHmr, npmChunks } from "./rollupPlugins";
import { readVendorFile } from "./utils";

const hmrClientCode = readVendorFile("esm-hmr/client.js");

export type CompilerMode = "production" | "development";

export default function createCompilerInputOptions({
  mode,
  sourceDir = "./src"
}: { mode?: CompilerMode; sourceDir?: string } = {}): rollup.InputOptions {
  let input: rollup.InputOption = {};

  // TODO: Get these from routes
  input["_src/main"] = path.resolve(sourceDir, "main.js");
  input["_src/message"] = path.resolve(sourceDir, "message.js");

  let plugins = [
    replace({
      "process.env.NODE_ENV": JSON.stringify(
        mode === "production" ? "production" : "development"
      )
    }),
    npmChunks({
      getChunkName: id => `_npm/${id}`
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

  return {
    input: input,
    plugins: plugins
  };
}
