/* eslint-disable import/no-extraneous-dependencies */
const path = require("path");
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");

const {
  copyToPlaygrounds,
  createBanner,
  getOutputDir,
  getVersion,
  isBareModuleId,
} = require("../../rollup-utils");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = path.relative(process.cwd(), __dirname) || ".";
  let outputDir = getOutputDir("@remix-run/react");
  let version = getVersion(sourceDir);

  // This CommonJS build of remix-react is for node; both for use in running our
  // server and for 3rd party tools that work with node.
  /** @type {import("rollup").RollupOptions} */
  let remixReactCJS = {
    external(id) {
      return isBareModuleId(id);
    },
    input: `${sourceDir}/index.tsx`,
    output: {
      banner: createBanner("@remix-run/react", version),
      dir: outputDir,
      format: "cjs",
      preserveModules: true,
      exports: "auto",
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
        rootMode: "upward",
      }),
      nodeResolve({ extensions: [".ts", ".tsx"] }),
      copy({
        targets: [
          { src: `LICENSE.md`, dest: outputDir },
          { src: `${sourceDir}/package.json`, dest: outputDir },
          { src: `${sourceDir}/README.md`, dest: outputDir },
        ],
      }),
      copyToPlaygrounds(),
    ],
  };

  // The browser build of remix-react is ESM so we can treeshake it.
  /** @type {import("rollup").RollupOptions} */
  let remixReactESM = {
    external(id) {
      return isBareModuleId(id);
    },
    input: `${sourceDir}/index.tsx`,
    output: {
      banner: createBanner("@remix-run/react", version),
      dir: `${outputDir}/esm`,
      format: "esm",
      preserveModules: true,
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
        rootMode: "upward",
      }),
      nodeResolve({ extensions: [".ts", ".tsx"] }),
      copyToPlaygrounds(),
    ],
  };

  /** @type {import("rollup").RollupOptions[]} */
  let remixReactMagicExportsCJS = {
    external() {
      return true;
    },
    input: `${sourceDir}/magicExports/remix.ts`,
    output: {
      banner: createBanner("@remix-run/react", version),
      dir: `${outputDir}/magicExports`,
      format: "cjs",
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
        rootMode: "upward",
      }),
      copyToPlaygrounds(),
    ],
  };

  /** @type {import("rollup").RollupOptions[]} */
  let remixReactMagicExportsESM = {
    external() {
      return true;
    },
    input: `${sourceDir}/magicExports/remix.ts`,
    output: {
      banner: createBanner("@remix-run/react", version),
      dir: `${outputDir}/magicExports/esm`,
      format: "esm",
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
        rootMode: "upward",
      }),
      copyToPlaygrounds(),
    ],
  };

  return [
    remixReactCJS,
    remixReactESM,
    remixReactMagicExportsCJS,
    remixReactMagicExportsESM,
  ];
};
