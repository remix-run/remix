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
          },
          {
            src: path.resolve(__dirname, "packages/dev/compiler2/shims"),
            dest: "build/node_modules/@remix-run/dev/compiler2"
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

/** @type {import("rollup").RollupOptions[]} */
let react = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/react/index.tsx"),
  output: {
    banner: banner,
    dir: "build/node_modules/@remix-run/react",
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
};

/** @type {import("rollup").RollupOptions} */
let serve = [
  {
    external(id) {
      return !isLocalModuleId(id);
    },
    input: [path.resolve(__dirname, "packages/serve/app.ts")],
    output: {
      banner: banner,
      dir: `build/node_modules/@remix-run/serve`,
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
            src: path.resolve(__dirname, `packages/serve/package.json`),
            dest: `build/node_modules/@remix-run/serve`
          }
        ]
      })
    ]
  },
  {
    external() {
      return true;
    },
    input: path.resolve(__dirname, "packages/serve/index.ts"),
    output: {
      banner: "#!/usr/bin/env node\n" + banner,
      dir: "build/node_modules/@remix-run/serve",
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

let create = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/create-remix/index.ts"),
  output: {
    banner: "#!/usr/bin/env node\n" + banner,
    dir: "build/node_modules/create-remix",
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
    }),
    copy({
      targets: [
        {
          src: path.resolve(__dirname, `packages/create-remix/package.json`),
          dest: `build/node_modules/create-remix`
        },
        {
          src: path.resolve(__dirname, `packages/create-remix/templates/*`),
          dest: `build/node_modules/create-remix/templates`
        }
      ]
    })
  ]
};

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

let builds = [
  ...dev,
  node,
  architect,
  express,
  vercel,
  react,
  create,
  ...serve
];

export default builds;
