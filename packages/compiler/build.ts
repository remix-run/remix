import path from "path";
import type { InputOptions } from "rollup";
import * as rollup from "rollup";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

import type { RemixConfig } from "@remix-run/core";
import { readConfig } from "@remix-run/core";

import type { CompilerMode } from "./createCompilerInputOptions";
// import createCompilerInputOptions from "./createCompilerInputOptions";

export interface BuildOptions {
  mode?: CompilerMode;
  outputDir?: string;
  remixRoot?: string;
}

function createInputFromRoutesConfig(
  routesConfig: RemixConfig["routesConfig"],
  appRoot: string,
  input: Record<string, string> = {}
) {
  for (let route of routesConfig) {
    input[route.id] = path.resolve(appRoot, "src", route.component);

    if (route.children) {
      createInputFromRoutesConfig(route.children, appRoot, input);
    }
  }

  return input;
}

export default async function build({
  mode = "production",
  remixRoot
}: BuildOptions = {}) {
  let config = await readConfig(remixRoot);
  let input = createInputFromRoutesConfig(config.routesConfig, config.appRoot);

  input.__entry_server__ = path.join(config.appRoot, "src", "entry-server");

  // Prune out .mdx for now...
  for (let key in input) {
    if (input[key].endsWith(".mdx")) {
      delete input[key];
    }
  }

  let serverProd: InputOptions = {
    input,
    external(id) {
      // Ignore node_modules, bare identifiers, etc.
      return !(id.startsWith("/") || id.startsWith("."));
    },
    plugins: [
      // loaders
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
      })
    ]
  };

  let build = await rollup.rollup(serverProd);

  return build;
}
