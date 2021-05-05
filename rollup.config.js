import fs from "fs";
import path from "path";
import babel from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";

function isBareModuleId(id) {
  return !id.startsWith(".") && !path.isAbsolute(id);
}

/** @return {import('rollup').Plugin} */
function copyAsset(
  file,
  { fileName = path.basename(file), transform = null } = {}
) {
  return {
    name: "copy-asset",
    buildStart() {
      this.addWatchFile(file);
    },
    generateBundle() {
      let source = fs.readFileSync(file);
      if (transform) source = transform(source);
      this.emitFile({ type: "asset", fileName, source });
    }
  };
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
    copyAsset(path.resolve(__dirname, "packages/create-remix/package.json")),
    copyAsset(path.resolve(__dirname, "packages/create-remix/README.md")),
    copy({
      targets: [
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
    copyAsset(path.resolve(__dirname, "packages/remix/package.json")),
    copyAsset(path.resolve(__dirname, "packages/remix/README.md"))
  ]
};

/** @type {import("rollup").RollupOptions} */
let remixMagic = {
  external(id) {
    return isBareModuleId(id);
  },
  input: path.resolve(__dirname, "packages/remix/magic.ts"),
  output: {
    banner: licenseBanner,
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
let remixBrowser = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/remix/index.ts"),
  output: {
    banner: licenseBanner,
    dir: "build/node_modules/remix/browser",
    format: "esm",
    preserveModules: true
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
    path.resolve(__dirname, "packages/remix-dev/config.ts")
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
    copyAsset(path.resolve(__dirname, "packages/remix-dev/package.json")),
    copy({
      targets: [
        {
          src: path.resolve(__dirname, "packages/remix-dev/compiler/shims"),
          dest: "build/node_modules/@remix-run/dev/compiler"
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
    copyAsset(path.resolve(__dirname, "packages/remix-node/package.json"), {
      transform(source) {
        let packageJson = {
          ...JSON.parse(source),
          scripts: {
            postinstall: "node scripts/postinstall.js"
          }
        };

        return JSON.stringify(packageJson, null, 2);
      }
    })
  ]
};

/** @type {import("rollup").RollupOptions} */
let remixNodeMagicExports = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/remix-node/magicExports/server.ts"),
  output: {
    banner: licenseBanner,
    dir: "build/node_modules/@remix-run/node/magicExports",
    format: "cjs"
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"]
    })
  ]
};

/** @type {import("rollup").RollupOptions} */
let remixNodeMagicExportsBrowser = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/remix-node/magicExports/server.ts"),
  output: {
    banner: licenseBanner,
    dir: "build/node_modules/@remix-run/node/magicExports/browser",
    format: "esm"
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"]
    })
  ]
};

/** @type {import("rollup").RollupOptions} */
let remixNodeScripts = {
  external(id) {
    return isBareModuleId(id);
  },
  input: [
    path.resolve(__dirname, "packages/remix-node/scripts/postinstall.ts")
  ],
  output: {
    banner: licenseBanner,
    dir: "build/node_modules/@remix-run/node/scripts",
    format: "cjs"
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"]
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
      copyAsset(path.resolve(__dirname, `packages/remix-${name}/package.json`))
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
    copyAsset(path.resolve(__dirname, "packages/remix-react/package.json"), {
      transform(source) {
        let packageJson = {
          ...JSON.parse(source),
          scripts: {
            postinstall: "node scripts/postinstall.js"
          }
        };

        return JSON.stringify(packageJson, null, 2);
      }
    })
  ]
};

/** @type {import("rollup").RollupOptions[]} */
let remixReactScripts = {
  external(id) {
    return isBareModuleId(id);
  },
  input: [
    path.resolve(__dirname, "packages/remix-react/scripts/postinstall.ts")
  ],
  output: {
    banner: licenseBanner,
    dir: "build/node_modules/@remix-run/react/scripts",
    format: "cjs"
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"]
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

/** @type {import("rollup").RollupOptions[]} */
let remixReactMagicExports = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/remix-react/magicExports/client.ts"),
  output: {
    banner: licenseBanner,
    dir: "build/node_modules/@remix-run/react/magicExports",
    format: "cjs"
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"]
    })
  ]
};

/** @type {import("rollup").RollupOptions[]} */
let remixReactMagicExportsBrowser = {
  external() {
    return true;
  },
  input: path.resolve(__dirname, "packages/remix-react/magicExports/client.ts"),
  output: {
    banner: licenseBanner,
    dir: "build/node_modules/@remix-run/react/magicExports/browser",
    format: "esm"
  },
  plugins: [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
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
    copyAsset(path.resolve(__dirname, "packages/remix-serve/package.json"))
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
  remixMagic,
  remixBrowser,
  remixDev,
  remixDevCli,
  remixNode,
  remixNodeScripts,
  remixNodeMagicExports,
  remixNodeMagicExportsBrowser,
  remixArchitect,
  remixExpress,
  remixVercel,
  remixReact,
  remixReactScripts,
  remixReactBrowser,
  remixReactMagicExports,
  remixReactMagicExportsBrowser,
  remixServe,
  remixServeCli
];

export default builds;
