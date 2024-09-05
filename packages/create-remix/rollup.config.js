const path = require("node:path");
const json = require("@rollup/plugin-json").default;
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");

const {
  createBanner,
  getCliConfig,
  getOutputDir,
  isBareModuleId,
} = require("../../rollup.utils");
const { name: packageName, version } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = "packages/create-remix";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner(packageName, version),
        dir: outputDist,
        format: "cjs",
        preserveModules: true,
        exports: "named",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        json(),
        nodeResolve({ extensions: [".ts"] }),
        copy({
          targets: [
            { src: "LICENSE.md", dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        // Allow dynamic imports in CJS code to allow us to utilize
        // ESM modules as part of the compiler.
        {
          name: "dynamic-import-polyfill",
          renderDynamicImport() {
            return {
              left: "import(",
              right: ")",
            };
          },
        },
      ],
    },
    getCliConfig({ packageName, version }),
  ];
};
