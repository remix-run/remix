const path = require("node:path");
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");
const replace = require("@rollup/plugin-replace");

const {
  copyToPlaygrounds,
  createBanner,
  getOutputDir,
  isBareModuleId,
} = require("../../rollup.utils");
const { name: packageName, version } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = "packages/remix-react";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");

  // This CommonJS build of remix-react is for node; both for use in running our
  // server and for 3rd party tools that work with node.
  /** @type {import("rollup").RollupOptions} */
  let remixReactCJS = {
    external(id) {
      return isBareModuleId(id);
    },
    input: `${sourceDir}/index.tsx`,
    output: {
      banner: createBanner(packageName, version),
      dir: outputDist,
      format: "cjs",
      preserveModules: true,
      exports: "auto",
    },
    plugins: [
      replace({
        preventAssignment: true,
        values: {
          "import.meta": "null",
        },
      }),
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
      }),
      nodeResolve({ extensions: [".ts", ".tsx"] }),
      copy({
        targets: [
          { src: "LICENSE.md", dest: [outputDir, sourceDir] },
          { src: `${sourceDir}/package.json`, dest: outputDir },
          { src: `${sourceDir}/README.md`, dest: outputDir },
          { src: `${sourceDir}/future`, dest: outputDir },
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
      dir: `${outputDist}/esm`,
      format: "esm",
      preserveModules: true,
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
      }),
      nodeResolve({ extensions: [".ts", ".tsx"] }),
      copyToPlaygrounds(),
    ],
  };

  return [remixReactCJS, remixReactESM];
};
