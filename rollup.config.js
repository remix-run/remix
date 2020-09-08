import path from "path";
import { builtinModules } from "module";
import copy from "rollup-plugin-copy";
import babel from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";

/** @type {import('rollup').RollupOptions} */
let core = {
  external: [...builtinModules],
  input: path.resolve(__dirname, "packages/core/index.ts"),
  output: {
    file: "build/@remix-run/core/index.js",
    format: "cjs"
  },
  plugins: [
    nodeResolve({
      extensions: [".ts", ".tsx"]
    }),
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"]
    }),
    copy({
      targets: [
        {
          src: path.resolve(__dirname, "packages/core/package.json"),
          dest: "build/@remix-run/core"
        }
      ]
    })
  ]
};

/** @type {import('rollup').RollupOptions} */
let express = {
  external: [...builtinModules],
  external: ["@remix-run/core"],
  input: path.resolve(__dirname, "packages/express/index.ts"),
  output: {
    file: "build/@remix-run/express/index.js",
    format: "cjs"
  },
  plugins: [
    nodeResolve({
      extensions: [".ts", ".tsx"]
    }),
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"]
    }),
    copy({
      targets: [
        {
          src: path.resolve(__dirname, "packages/express/package.json"),
          dest: "build/@remix-run/express"
        }
      ]
    })
  ]
};

/** @type {import('rollup').RollupOptions[]} */
let react = [
  {
    external: ["react"],
    input: path.resolve(__dirname, "packages/react/index.tsx"),
    output: {
      file: "build/@remix-run/react/index.js",
      format: "esm"
    },
    plugins: [
      // TODO: Don't rely on main babel.config.js which targets node: current.
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"]
      }),
      copy({
        targets: [
          {
            src: path.resolve(__dirname, "packages/react/package.json"),
            dest: "build/@remix-run/react"
          }
        ]
      })
    ]
  },
  // Also provide CommonJS build for webpack.
  {
    external: ["react"],
    input: path.resolve(__dirname, "packages/react/index.tsx"),
    output: {
      file: "build/@remix-run/react/index.cjs",
      format: "cjs"
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"]
      })
    ]
  }
];

export default [core, express, ...react];
