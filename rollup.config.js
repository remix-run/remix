import path from "path";
import copy from "rollup-plugin-copy";
import babel from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";

/** @type {import('rollup').RollupOptions} */
let core = {
  external(id) {
    return !(id.startsWith(".") || id.startsWith("/"));
  },
  input: path.resolve(__dirname, "packages/core/index.ts"),
  output: {
    dir: "build/node_modules/@remix-run/core",
    format: "cjs",
    preserveModules: true,
    exports: "auto"
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
          dest: "build/node_modules/@remix-run/core"
        }
      ]
    })
  ]
};

/** @type {import('rollup').RollupOptions} */
// let compiler = {
//   external(id) {
//     return !(id.startsWith(".") || id.startsWith("/"));
//   },
//   input: path.resolve(__dirname, "packages/compiler/index.ts"),
//   output: {
//     dir: "build/node_modules/@remix-run/compiler",
//     format: "cjs",
//     exports: "named",
//     preserveModules: true
//   },
//   plugins: [
//     nodeResolve({
//       extensions: [".ts", ".tsx"]
//     }),
//     babel({
//       babelHelpers: "bundled",
//       exclude: /node_modules/,
//       extensions: [".ts", ".tsx"]
//     }),
//     copy({
//       targets: [
//         {
//           src: path.resolve(__dirname, "packages/compiler/package.json"),
//           dest: "build/node_modules/@remix-run/compiler"
//         }
//       ]
//     })
//   ]
// };

/** @type {import('rollup').RollupOptions} */
let express = {
  external(id) {
    return !(id.startsWith(".") || id.startsWith("/"));
  },
  input: path.resolve(__dirname, "packages/express/index.ts"),
  output: {
    dir: "build/node_modules/@remix-run/express",
    format: "cjs",
    preserveModules: true,
    exports: "auto"
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
          dest: "build/node_modules/@remix-run/express"
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
      file: "build/node_modules/@remix-run/react/index.js",
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
            dest: "build/node_modules/@remix-run/react"
          }
        ]
      })
    ]
  },

  // Also provide CommonJS build for entry-server.js
  {
    external: ["react"],
    input: {
      server: path.resolve(__dirname, "packages/react/server.tsx")
    },
    output: {
      dir: "build/node_modules/@remix-run/react/cjs",
      format: "cjs",
      preserveModules: true
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
