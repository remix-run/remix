import path from "path";
import babel from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";

function isBareModuleId(id) {
  return !id.startsWith(".") && !path.isAbsolute(id);
}

let executableBanner = "#!/usr/bin/env node\n";

function createBanner(libraryName, version) {
  return `/**
 * ${libraryName} v${version}
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */`;
}

function getVersion(sourceDir) {
  return require(`./${sourceDir}/package.json`).version;
}

/** @type {import("rollup").RollupOptions[]} */
function createRemix() {
  let SOURCE_DIR = "packages/create-remix";
  let OUTPUT_DIR = "build/node_modules/create-remix";
  let version = getVersion(SOURCE_DIR);

  return [
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/cli.ts`,
      output: {
        format: "cjs",
        dir: OUTPUT_DIR,
        banner: executableBanner + createBanner("create-remix", version)
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"]
        }),
        nodeResolve({ extensions: [".ts"] }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/package.json`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/README.md`, dest: OUTPUT_DIR },
            {
              src: `${SOURCE_DIR}/templates/*`,
              dest: `${OUTPUT_DIR}/templates`
            }
          ]
        })
      ]
    }
  ];
}

/** @type {import("rollup").RollupOptions[]} */
function remix() {
  let SOURCE_DIR = "packages/remix";
  let OUTPUT_DIR = "build/node_modules/remix";
  let version = getVersion(SOURCE_DIR);

  return [
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/index.ts`,
      output: {
        format: "cjs",
        dir: OUTPUT_DIR,
        banner: createBanner("remix", version)
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"]
        }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/package.json`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/README.md`, dest: OUTPUT_DIR }
          ]
        })
      ]
    },
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/index.ts`,
      output: {
        banner: createBanner("remix", version),
        dir: `${OUTPUT_DIR}/esm`,
        format: "esm"
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"]
        })
      ]
    }
  ];
}

/** @type {import("rollup").RollupOptions[]} */
function remixDev() {
  let SOURCE_DIR = "packages/remix-dev";
  let OUTPUT_DIR = "build/node_modules/@remix-run/dev";
  let version = getVersion(SOURCE_DIR);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: [
        `${SOURCE_DIR}/cli/commands.ts`,
        `${SOURCE_DIR}/compiler.ts`,
        `${SOURCE_DIR}/config.ts`,
        `${SOURCE_DIR}/index.ts`
      ],
      output: {
        banner: createBanner("@remix-run/dev", version),
        dir: OUTPUT_DIR,
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
        nodeResolve({ extensions: [".ts"] }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/package.json`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/README.md`, dest: OUTPUT_DIR },
            {
              src: `${SOURCE_DIR}/compiler/shims`,
              dest: `${OUTPUT_DIR}/compiler`
            }
          ]
        }),
        // Allow dynamic imports in CJS code to allow us to utilize
        // ESM modules as part of the compiler.
        {
          name: "dynamic-import-polyfill",
          renderDynamicImport() {
            return {
              left: "import(",
              right: ")"
            };
          }
        }
      ]
    },
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/cli.ts`,
      output: {
        banner: executableBanner + createBanner("@remix-run/dev", version),
        dir: OUTPUT_DIR,
        format: "cjs"
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"]
        }),
        nodeResolve({ extensions: [".ts"] })
      ]
    }
  ];
}

/** @type {import("rollup").RollupOptions[]} */
function remixServerRuntime() {
  let SOURCE_DIR = "packages/remix-server-runtime";
  let OUTPUT_DIR = "build/node_modules/@remix-run/server-runtime";
  let version = getVersion(SOURCE_DIR);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${SOURCE_DIR}/index.ts`,
      output: {
        banner: createBanner("@remix-run/server-runtime", version),
        dir: OUTPUT_DIR,
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
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/package.json`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/README.md`, dest: OUTPUT_DIR }
          ]
        })
      ]
    },
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${SOURCE_DIR}/index.ts`,
      output: {
        banner: createBanner("@remix-run/server-runtime", version),
        dir: `${OUTPUT_DIR}/esm`,
        format: "esm",
        preserveModules: true
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"]
        }),
        nodeResolve({ extensions: [".ts", ".tsx"] })
      ]
    },
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/magicExports/server.ts`,
      output: {
        banner: createBanner("@remix-run/server-runtime", version),
        dir: `${OUTPUT_DIR}/magicExports`,
        format: "cjs"
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"]
        })
      ]
    },
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/magicExports/server.ts`,
      output: {
        banner: createBanner("@remix-run/server-runtime", version),
        dir: `${OUTPUT_DIR}/magicExports/esm`,
        format: "esm"
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
}

/** @type {import("rollup").RollupOptions[]} */
function remixNode() {
  let SOURCE_DIR = "packages/remix-node";
  let OUTPUT_DIR = "build/node_modules/@remix-run/node";
  let version = getVersion(SOURCE_DIR);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${SOURCE_DIR}/index.ts`,
      output: {
        banner: createBanner("@remix-run/node", version),
        dir: OUTPUT_DIR,
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
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/package.json`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/README.md`, dest: OUTPUT_DIR }
          ]
        })
      ]
    },
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/magicExports/platform.ts`,
      output: {
        banner: createBanner("@remix-run/node", version),
        dir: `${OUTPUT_DIR}/magicExports`,
        format: "cjs"
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"]
        })
      ]
    },
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/magicExports/platform.ts`,
      output: {
        banner: createBanner("@remix-run/node", version),
        dir: `${OUTPUT_DIR}/magicExports/esm`,
        format: "esm"
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
}

/** @type {import("rollup").RollupOptions[]} */
function remixCloudflareWorkers() {
  let SOURCE_DIR = "packages/remix-cloudflare-workers";
  let OUTPUT_DIR = "build/node_modules/@remix-run/cloudflare-workers";
  let version = getVersion(SOURCE_DIR);

  return [
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/magicExports/platform.ts`,
      output: {
        banner: createBanner("@remix-run/cloudflare-workers", version),
        dir: `${OUTPUT_DIR}/magicExports`,
        format: "cjs"
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"]
        })
      ]
    },
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/magicExports/platform.ts`,
      output: {
        banner: createBanner("@remix-run/cloudflare-workers", version),
        dir: `${OUTPUT_DIR}/magicExports/esm`,
        format: "esm"
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
}

/** @return {import("rollup").RollupOptions} */
function getServerConfig(name) {
  let LIBRARY_NAME = `@remix-run/${name}`;
  let SOURCE_DIR = `packages/remix-${name}`;
  let OUTPUT_DIR = `build/node_modules/${LIBRARY_NAME}`;
  let version = getVersion(SOURCE_DIR);

  return {
    external(id) {
      return isBareModuleId(id);
    },
    input: `${SOURCE_DIR}/index.ts`,
    output: {
      banner: createBanner(LIBRARY_NAME, version),
      dir: OUTPUT_DIR,
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
      nodeResolve({ extensions: [".ts", ".tsx"] }),
      copy({
        targets: [
          { src: `LICENSE.md`, dest: OUTPUT_DIR },
          { src: `${SOURCE_DIR}/package.json`, dest: OUTPUT_DIR },
          { src: `${SOURCE_DIR}/README.md`, dest: OUTPUT_DIR }
        ]
      })
    ]
  };
}

/** @type {import("rollup").RollupOptions[]} */
function remixServerAdapters() {
  return [
    getServerConfig("architect"),
    getServerConfig("cloudflare-workers"),
    getServerConfig("express"),
    getServerConfig("vercel"),
    getServerConfig("netlify")
  ];
}

/** @type {import("rollup").RollupOptions[]} */
function remixReact() {
  let SOURCE_DIR = "packages/remix-react";
  let OUTPUT_DIR = "build/node_modules/@remix-run/react";
  let version = getVersion(SOURCE_DIR);

  /** @type {import("rollup").RollupOptions} */
  // This CommonJS build of remix-react is for node; both for use in running our
  // server and for 3rd party tools that work with node.
  let remixReactCJS = {
    external(id) {
      return isBareModuleId(id);
    },
    input: `${SOURCE_DIR}/index.tsx`,
    output: {
      banner: createBanner("@remix-run/react", version),
      dir: OUTPUT_DIR,
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
      nodeResolve({ extensions: [".ts", ".tsx"] }),
      copy({
        targets: [
          { src: `LICENSE.md`, dest: OUTPUT_DIR },
          { src: `${SOURCE_DIR}/package.json`, dest: OUTPUT_DIR },
          { src: `${SOURCE_DIR}/README.md`, dest: OUTPUT_DIR }
        ]
      })
    ]
  };

  // The browser build of remix-react is ESM so we can treeshake it.
  /** @type {import("rollup").RollupOptions} */
  let remixReactESM = {
    external(id) {
      return isBareModuleId(id);
    },
    input: `${SOURCE_DIR}/index.tsx`,
    output: {
      banner: createBanner("@remix-run/react", version),
      dir: `${OUTPUT_DIR}/esm`,
      format: "esm",
      preserveModules: true
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"]
      }),
      nodeResolve({ extensions: [".ts", ".tsx"] })
    ]
  };

  /** @type {import("rollup").RollupOptions[]} */
  let remixReactMagicExportsCJS = {
    external() {
      return true;
    },
    input: `${SOURCE_DIR}/magicExports/client.ts`,
    output: {
      banner: createBanner("@remix-run/react", version),
      dir: `${OUTPUT_DIR}/magicExports`,
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
  let remixReactMagicExportsESM = {
    external() {
      return true;
    },
    input: `${SOURCE_DIR}/magicExports/client.ts`,
    output: {
      banner: createBanner("@remix-run/react", version),
      dir: `${OUTPUT_DIR}/magicExports/esm`,
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

  return [
    remixReactCJS,
    remixReactESM,
    remixReactMagicExportsCJS,
    remixReactMagicExportsESM
  ];
}

/** @type {import("rollup").RollupOptions[]} */
function remixServe() {
  let SOURCE_DIR = "packages/remix-serve";
  let OUTPUT_DIR = "build/node_modules/@remix-run/serve";
  let version = getVersion(SOURCE_DIR);

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${SOURCE_DIR}/index.ts`,
      output: {
        banner: createBanner("@remix-run/serve", version),
        dir: OUTPUT_DIR,
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
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/package.json`, dest: OUTPUT_DIR },
            { src: `${SOURCE_DIR}/README.md`, dest: OUTPUT_DIR }
          ]
        })
      ]
    },
    {
      external() {
        return true;
      },
      input: `${SOURCE_DIR}/cli.ts`,
      output: {
        banner: executableBanner + createBanner("@remix-run/serve", version),
        dir: OUTPUT_DIR,
        format: "cjs"
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"]
        }),
        nodeResolve({ extensions: [".ts"] })
      ]
    }
  ];
}

export default function rollup(options) {
  let builds = [
    ...createRemix(options),
    ...remix(options),
    ...remixDev(options),
    ...remixServerRuntime(options),
    ...remixNode(options),
    ...remixCloudflareWorkers(options),
    ...remixServerAdapters(options),
    ...remixReact(options),
    ...remixServe(options)
  ];

  return builds;
}
