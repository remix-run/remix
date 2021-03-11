import fs from "fs";
import path from "path";
import babel from "@rollup/plugin-babel";
import copy from "rollup-plugin-copy";
import nodeResolve from "@rollup/plugin-node-resolve";

function isLocalModuleId(id) {
  return id.startsWith(".") || path.isAbsolute(id);
}

const licenseFile = path.resolve(__dirname, "LICENSE.md");
const license = fs.readFileSync(licenseFile, "utf-8");
const banner = "// " + license.split("\n").join("\n// ");

/** @type {import("rollup").RollupOptions} */
let dev = [
  {
    external(id) {
      return !isLocalModuleId(id);
    },
    input: [
      path.resolve(__dirname, "packages/dev/cli/commands.ts"),
      path.resolve(__dirname, "packages/dev/compiler.ts"),
      path.resolve(__dirname, "packages/dev/config.ts"),
      path.resolve(__dirname, "packages/dev/server.ts")
    ],
    output: {
      banner: banner,
      dir: "build/node_modules/@remix-run/dev",
      format: "cjs",
      preserveModules: true,
      exports: "named"
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
            src: path.resolve(__dirname, "packages/dev/package.json"),
            dest: "build/node_modules/@remix-run/dev"
          }
        ]
      })
    ]
  },
  // We need to build the CLI separately because it requires a special banner so
  // it can be started with the node executable.
  {
    external() {
      return true;
    },
    input: path.resolve(__dirname, "packages/dev/cli.ts"),
    output: {
      banner: "#!/usr/bin/env node\n" + banner,
      dir: "build/node_modules/@remix-run/dev",
      format: "cjs"
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts"]
      }),
      nodeResolve({
        extensions: [".ts"]
      })
    ]
  }
];

/** @type {import("rollup").RollupOptions} */
let node = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/node/index.ts"),
  output: {
    banner: banner,
    dir: "build/node_modules/@remix-run/node",
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
    }),
    copy({
      targets: [
        {
          src: path.resolve(__dirname, "packages/node/package.json"),
          dest: "build/node_modules/@remix-run/node"
        }
      ]
    })
  ]
};

/** @type {import("rollup").RollupOptions} */
let data = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/data/index.ts"),
  output: {
    banner: banner,
    dir: "build/node_modules/@remix-run/data",
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
          src: path.resolve(__dirname, "packages/data/package.json"),
          dest: "build/node_modules/@remix-run/data"
        }
      ]
    })
  ]
};

/** @type {import("rollup").RollupOptions[]} */
let react = [
  // We need 2 builds for @remix-run/react. Here's why:
  //
  // - ESM build runs in the browser and uses dynamic `import()` in the route
  //   loader to load route modules from the server
  // - CommonJS build runs on the server. It doesn't need to do any dynamic code
  //   loading because it loads all route modules up front when the server boots
  //
  // The compiler aliases @remix-run/react to @remix-run/react/esm when building
  // browser bundles (see packages/node/compiler.ts).
  //
  // TODO: We may eventually need a 3rd build that uses SystemJS for the route
  // loader in a <script nomodule> for older browsers (IE 11), depending on what
  // our browser support level is.
  {
    external(id) {
      return !isLocalModuleId(id);
    },
    input: {
      browser: path.resolve(__dirname, "packages/react/browser.tsx"),
      index: path.resolve(__dirname, "packages/react/index.tsx")
    },
    output: {
      banner: banner,
      dir: "build/node_modules/@remix-run/react/esm",
      format: "esm",
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
            src: path.resolve(__dirname, "packages/react/package.json"),
            dest: "build/node_modules/@remix-run/react"
          }
        ]
      })
    ]
  },
  {
    external(id) {
      return !isLocalModuleId(id);
    },
    input: {
      index: path.resolve(__dirname, "packages/react/index.tsx"),
      server: path.resolve(__dirname, "packages/react/server.tsx")
    },
    output: {
      banner: banner,
      dir: "build/node_modules/@remix-run/react",
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
      })
    ]
  }
];

function getServerConfig(name) {
  /** @type {import("rollup").RollupOptions} */
  return {
    external(id) {
      return !isLocalModuleId(id);
    },
    input: path.resolve(__dirname, `packages/${name}/index.ts`),
    output: {
      banner: banner,
      dir: `build/node_modules/@remix-run/${name}`,
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
            src: path.resolve(__dirname, `packages/${name}/package.json`),
            dest: `build/node_modules/@remix-run/${name}`
          }
        ]
      })
    ]
  };
}

let architect = getServerConfig("architect");
let express = getServerConfig("express");
let vercel = getServerConfig("vercel");

let builds = [node, data, ...dev, architect, express, vercel, ...react];

export default builds;
