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
let remixDev = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: [
    path.resolve(__dirname, "packages/remix-dev/cli/commands.ts"),
    path.resolve(__dirname, "packages/remix-dev/compiler.ts"),
    path.resolve(__dirname, "packages/remix-dev/config.ts"),
    path.resolve(__dirname, "packages/remix-dev/server.ts")
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
          src: path.resolve(__dirname, "packages/remix-dev/package.json"),
          dest: "build/node_modules/@remix-run/dev"
        },
        {
          src: path.resolve(__dirname, "packages/remix-dev/compiler2/shims"),
          dest: "build/node_modules/@remix-run/dev/compiler2"
        }
      ]
    })
  ]
};

// We need to build the CLI separately because it requires a special banner so
// it can be started with the node executable.
/** @type {import("rollup").RollupOptions} */
let remixDevCli = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/remix-dev/cli.ts"),
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
};

/** @type {import("rollup").RollupOptions} */
let remixNode = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/remix-node/index.ts"),
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
          src: path.resolve(__dirname, "packages/remix-node/package.json"),
          dest: "build/node_modules/@remix-run/node"
        }
      ]
    })
  ]
};

/** @type {import("rollup").RollupOptions[]} */
let remixReact = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/remix-react/index.tsx"),
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
          src: path.resolve(__dirname, "packages/remix-react/package.json"),
          dest: "build/node_modules/@remix-run/react"
        }
      ]
    })
  ]
};

/** @type {import("rollup").RollupOptions} */
let remixServe = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: [path.resolve(__dirname, "packages/remix-serve/index.ts")],
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
          src: path.resolve(__dirname, "packages/remix-serve/package.json"),
          dest: `build/node_modules/@remix-run/serve`
        }
      ]
    })
  ]
};

/** @type {import("rollup").RollupOptions} */
let remixServeCli = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/remix-serve/cli.ts"),
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
};

/** @type {import("rollup").RollupOptions} */
let createRemix = {
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
          src: path.resolve(__dirname, "packages/create-remix/package.json"),
          dest: "build/node_modules/create-remix"
        },
        {
          src: path.resolve(__dirname, "packages/create-remix/README.md"),
          dest: "build/node_modules/create-remix"
        },
        {
          src: path.resolve(__dirname, "packages/create-remix/templates/*"),
          dest: "build/node_modules/create-remix/templates"
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
    input: path.resolve(__dirname, `packages/remix-${name}/index.ts`),
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
            src: path.resolve(__dirname, `packages/remix-${name}/package.json`),
            dest: `build/node_modules/@remix-run/${name}`
          }
        ]
      })
    ]
  };
}

let remixArchitect = getServerConfig("architect");
let remixExpress = getServerConfig("express");
let remixVercel = getServerConfig("vercel");

let builds = [
  remixDev,
  remixDevCli,
  remixNode,
  remixArchitect,
  remixExpress,
  remixVercel,
  remixReact,
  createRemix,
  remixServe,
  remixServeCli
];

export default builds;
