import fs from "fs";
import path from "path";
import babel from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";

function isBareModuleId(id) {
  return !id.startsWith(".") && !path.isAbsolute(id);
}

const licenseFile = path.resolve(__dirname, "LICENSE.md");
const license = fs.readFileSync(licenseFile, "utf-8");
const licenseBanner = "// " + license.split("\n").join("\n// ");

/** @type {import("rollup").RollupOptions} */
let createRemix = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/create-remix/index.ts"),
  output: {
    banner: "#!/usr/bin/env node\n" + licenseBanner,
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

/** @type {import("rollup").RollupOptions} */
let remix = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/remix/index.ts"),
  output: {
    banner: licenseBanner,
    dir: "build/node_modules/remix",
    format: "cjs",
    preserveModules: true
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts"]
    }),
    copy({
      targets: [
        {
          src: path.resolve(__dirname, "packages/remix/package.json"),
          dest: "build/node_modules/remix"
        },
        {
          src: path.resolve(__dirname, "packages/remix/README.md"),
          dest: "build/node_modules/remix"
        }
      ]
    })
  ]
};

/** @type {import("rollup").RollupOptions} */
let remixSetupCli = {
  external(id) {
    return isBareModuleId(id);
  },
  input: path.resolve(__dirname, "packages/remix/cli.ts"),
  output: {
    banner: "#!/usr/bin/env node\n" + licenseBanner,
    dir: "build/node_modules/remix",
    format: "cjs"
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts"]
    })
  ]
};

/** @type {import("rollup").RollupOptions} */
let remixDev = {
  external(id) {
    return isBareModuleId(id);
  },
  input: [
    path.resolve(__dirname, "packages/remix-dev/cli/commands.ts"),
    path.resolve(__dirname, "packages/remix-dev/compiler.ts"),
    path.resolve(__dirname, "packages/remix-dev/config.ts"),
    path.resolve(__dirname, "packages/remix-dev/server.ts")
  ],
  output: {
    banner: licenseBanner,
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

/** @type {import("rollup").RollupOptions} */
let remixDevCli = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/remix-dev/cli.ts"),
  output: {
    banner: "#!/usr/bin/env node\n" + licenseBanner,
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
    return isBareModuleId(id);
  },
  input: path.resolve(__dirname, "packages/remix-node/index.ts"),
  output: {
    banner: licenseBanner,
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

/** @return {import("rollup").RollupOptions} */
function getServerConfig(name) {
  return {
    external(id) {
      return isBareModuleId(id);
    },
    input: path.resolve(__dirname, `packages/remix-${name}/index.ts`),
    output: {
      banner: licenseBanner,
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

// This CommonJS build of remix-react is for node; both for use in running our
// server and for 3rd party tools that work with node.
/** @type {import("rollup").RollupOptions[]} */
let remixReact = {
  external(id) {
    return isBareModuleId(id);
  },
  input: path.resolve(__dirname, "packages/remix-react/index.tsx"),
  output: {
    banner: licenseBanner,
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

// The browser build of remix-react is ESM so we can treeshake it.
/** @type {import("rollup").RollupOptions[]} */
let remixReactBrowser = {
  external(id) {
    return isBareModuleId(id);
  },
  input: path.resolve(__dirname, "packages/remix-react/index.tsx"),
  output: {
    banner: licenseBanner,
    dir: "build/node_modules/@remix-run/react/browser",
    format: "esm",
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
    })
  ]
};

/** @type {import("rollup").RollupOptions} */
let remixServe = {
  external(id) {
    return isBareModuleId(id);
  },
  input: [path.resolve(__dirname, "packages/remix-serve/index.ts")],
  output: {
    banner: licenseBanner,
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
    banner: "#!/usr/bin/env node\n" + licenseBanner,
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

let builds = [
  createRemix,
  remix,
  remixSetupCli,
  remixDev,
  remixDevCli,
  remixNode,
  remixArchitect,
  remixExpress,
  remixVercel,
  remixReact,
  remixReactBrowser,
  remixServe,
  remixServeCli
];

export default builds;
