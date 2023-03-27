const path = require("node:path");
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");

const {
  copyToPlaygrounds,
  createBanner,
  getOutputDir,
  isBareModuleId,
} = require("../../rollup.utils");
const { name: packageName, version } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = path.join("packages", "remix-route-convention");
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");

  let sharedPlugins = [
    babel({
      babelHelpers: "bundled",
      exclude: /node_modules/,
      extensions: [".ts", ".tsx"],
    }),
    nodeResolve({ extensions: [".ts", ".tsx"] }),
    copyToPlaygrounds(),
  ];

  /** @type {import("rollup").RollupOptions} */
  let routeConventionCJS = {
    external(id) {
      return isBareModuleId(id);
    },
    input: path.join(sourceDir, "index.ts"),
    output: {
      banner: createBanner(packageName, version),
      dir: outputDist,
      format: "cjs",
      preserveModules: true,
      exports: "auto",
    },
    plugins: [
      ...sharedPlugins,
      copy({
        targets: [
          { src: "LICENSE.md", dest: [outputDir, sourceDir] },
          { src: path.join(sourceDir, "package.json"), dest: outputDir },
          { src: path.join(sourceDir, "README.md"), dest: outputDir },
        ],
      }),
    ],
  };

  /** @type {import("rollup").RollupOptions} */
  let routeConventionESM = {
    external(id) {
      return isBareModuleId(id);
    },
    input: path.join(sourceDir, "index.ts"),
    output: {
      banner: createBanner(packageName, version),
      dir: path.join(outputDist, "esm"),
      format: "esm",
      preserveModules: true,
    },
    plugins: [...sharedPlugins],
  };

  return [routeConventionCJS, routeConventionESM];
};
