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
  let sourceDir = "packages/remix-fs-routes";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");

  return [
    {
      external: (id) => isBareModuleId(id),
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner(packageName, version),
        dir: outputDist,
        format: "cjs",
        preserveModules: true,
        exports: "auto",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        nodeResolve({ extensions: [".ts"] }),
        copy({
          targets: [{ src: "LICENSE.md", dest: sourceDir }],
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
};
