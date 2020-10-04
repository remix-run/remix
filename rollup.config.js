import path from "path";
import copy from "rollup-plugin-copy";
import babel from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";

function isLocalModuleId(id) {
  return id.startsWith(".") || id.startsWith("/");
}

/** @type {import('rollup').RollupOptions} */
let core = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/core/index.ts"),
  output: {
    dir: "build/node_modules/@remix-run/core",
    format: "cjs",
    preserveModules: true,
    exports: "auto"
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"]
    }),
    nodeResolve({
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
let cli = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/cli/index.ts"),
  output: {
    dir: "build/node_modules/@remix-run/cli",
    format: "cjs",
    banner: "#!/usr/bin/env node"
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts"]
    }),
    nodeResolve({
      extensions: [".ts"]
    }),
    copy({
      targets: [
        {
          src: path.resolve(__dirname, "packages/cli/package.json"),
          dest: "build/node_modules/@remix-run/cli"
        }
      ]
    })
  ]
};

/** @type {import('rollup').RollupOptions} */
let express = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/express/index.ts"),
  output: {
    dir: "build/node_modules/@remix-run/express",
    format: "cjs",
    preserveModules: true
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"]
    }),
    nodeResolve({
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

/** @type {import('rollup').RollupOptions} */
let loader = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/loader/index.ts"),
  output: {
    dir: "build/node_modules/@remix-run/loader",
    format: "cjs",
    preserveModules: true
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"]
    }),
    nodeResolve({
      extensions: [".ts", ".tsx"]
    }),
    copy({
      targets: [
        {
          src: path.resolve(__dirname, "packages/loader/package.json"),
          dest: "build/node_modules/@remix-run/loader"
        }
      ]
    })
  ]
};

/** @type {import('rollup').RollupOptions[]} */
let react = [
  {
    external(id) {
      return !isLocalModuleId(id);
    },
    input: {
      index: path.resolve(__dirname, "packages/react/index.tsx"),
      browser: path.resolve(__dirname, "packages/react/browser.tsx")
    },
    output: {
      dir: "build/node_modules/@remix-run/react/esm",
      format: "esm",
      preserveModules: true
    },
    plugins: [
      // TODO: Don't rely on main babel.config.js which targets node: current.
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"]
      }),
      nodeResolve({
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
    external(id) {
      return !isLocalModuleId(id);
    },
    input: {
      index: path.resolve(__dirname, "packages/react/index.tsx"),
      server: path.resolve(__dirname, "packages/react/server.tsx")
    },
    output: {
      dir: "build/node_modules/@remix-run/react",
      format: "cjs",
      preserveModules: true,
      exports: "named"
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"]
      }),
      nodeResolve({
        extensions: [".ts", ".tsx"]
      })
    ]
  }
];

export default [core, cli, express, loader, ...react];
