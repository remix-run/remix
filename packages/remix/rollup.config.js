const babel = require("@rollup/plugin-babel").default;
const path = require("path");

const {
  copyPublishFiles,
  copyToPlaygrounds,
  createBanner,
  getOutputDir,
} = require("../../rollup.utils");
let { name: packageName, version } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  // Don't blow away remix magic exports on local builds, since they've
  // already been configured by postinstall
  if (process.env.LOCAL_BUILD_DIRECTORY) {
    return [];
  }

  let sourceDir = "packages/remix";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");

  return [
    {
      external() {
        return true;
      },
      input: `${sourceDir}/index.ts`,
      output: {
        format: "cjs",
        dir: outputDist,
        banner: createBanner(packageName, version),
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        copyPublishFiles(packageName),
        copyToPlaygrounds(),
      ],
    },
    {
      external() {
        return true;
      },
      input: `${sourceDir}/index.ts`,
      output: {
        format: "esm",
        dir: path.join(outputDist, "esm"),
        banner: createBanner(packageName, version),
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        copyPublishFiles(packageName),
        copyToPlaygrounds(),
      ],
    },
  ];
};
