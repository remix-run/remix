import path from "path";
import babel from "@rollup/plugin-babel";
import copy from "rollup-plugin-copy";
import nodeResolve from "@rollup/plugin-node-resolve";

function isLocalModuleId(id) {
  return id.startsWith(".") || path.isAbsolute(id);
}

/** @type {import('rollup').RollupOptions} */
let cli = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/cli/index.ts"),
  output: {
    banner: "#!/usr/bin/env node",
    dir: "build/node_modules/@remix-run/cli",
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
          src: path.resolve(__dirname, "packages/cli/package.json"),
          dest: "build/node_modules/@remix-run/cli"
        }
      ]
    })
  ]
};

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
          src: path.resolve(__dirname, "packages/core/package.json"),
          dest: "build/node_modules/@remix-run/core"
        }
      ]
    })
  ]
};

/** @type {import('rollup').RollupOptions} */
let data = {
  external(id) {
    return !isLocalModuleId(id);
  },
  input: path.resolve(__dirname, "packages/data/index.ts"),
  output: {
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

/** @type {import('rollup').RollupOptions[]} */
let react = [
  // We need 2 builds for @remix-run/react. Here's why:
  //
  // - ESM build runs in the browser and uses dynamic `import()` in the route
  //   loader to load route modules from the server
  // - CommonJS build runs on the server. It doesn't need to do any dynamic code
  //   loading because it loads all route modules up front when the server boots
  //
  // The compiler aliases @remix-run/react to @remix-run/react/esm when building
  // browser bundles (see packages/core/compiler.ts).
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

let architect = getPlatformConfig("architect");
let express = getPlatformConfig("express");
let vercel = getPlatformConfig("vercel");

function getPlatformConfig(name) {
  /** @type {import('rollup').RollupOptions} */
  return {
    external(id) {
      return !isLocalModuleId(id);
    },
    input: path.resolve(__dirname, `packages/${name}/index.ts`),
    output: {
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

let builds = [architect, cli, core, data, express, vercel, ...react];
export default builds;
