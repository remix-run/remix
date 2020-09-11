import path from "path";
import type { InputOptions } from "rollup";
import * as rollup from "rollup";
import babel from "@rollup/plugin-babel";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

import type { RemixConfig } from "@remix-run/core";
import { readConfig } from "@remix-run/core";

import manifest from "./rollup/manifest";

export enum BuildMode {
  Production = "production",
  Development = "development"
}

export interface BuildOptions {
  mode?: BuildMode;
  remixRoot?: string;
}

function createInputFromRoutesConfig(
  routesConfig: RemixConfig["routes"],
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
  mode = BuildMode.Production,
  remixRoot
}: BuildOptions = {}) {
  let config = await readConfig(remixRoot);
  let input = createInputFromRoutesConfig(config.routes, config.rootDirectory);

  input.__entry_server__ = path.join(
    config.rootDirectory,
    "src",
    "entry-server"
  );

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
      }),
      manifest({
        outputDir: config.serverBuildDirectory
      })
    ]
  };

  let build = await rollup.rollup(serverProd);

  return build;
}
