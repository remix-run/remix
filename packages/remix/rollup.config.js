/* eslint-disable import/no-extraneous-dependencies */
const path = require("path");
const babel = require("@rollup/plugin-babel").default;
const copy = require("rollup-plugin-copy");

const {
  copyToPlaygrounds,
  createBanner,
  getBuildInfo,
  REPO_ROOT_DIR,
} = require("../../rollup.utils");
let { name: packageName } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  // Don't blow away remix magic exports on local builds, since they've
  // already been configured by postinstall
  if (process.env.REMIX_LOCAL_BUILD_DIRECTORY) {
    return [];
  }

  let sourcePackageRoot = __dirname;
  let { outputDir, packageRoot, sourceDir, version } =
    getBuildInfo(packageName);

  let copyTargets = [
    { src: path.join(REPO_ROOT_DIR, "LICENSE.md"), dest: packageRoot },
  ];
  if (sourcePackageRoot !== packageRoot) {
    copyTargets.push({
      src: path.join(sourcePackageRoot, "package.json"),
      dest: packageRoot,
    });
    copyTargets.push({
      src: path.join(sourcePackageRoot, "CHANGELOG.md"),
      dest: packageRoot,
    });
    copyTargets.push({
      src: path.join(sourcePackageRoot, "README.md"),
      dest: packageRoot,
    });
  }

  return [
    {
      external() {
        return true;
      },
      input: path.join(sourceDir, "index.ts"),
      output: {
        format: "cjs",
        dir: outputDir,
        banner: createBanner(packageName, version),
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
          rootMode: "upward",
        }),
        copy({ targets: copyTargets }),
        copyToPlaygrounds(),
      ],
    },
    {
      external() {
        return true;
      },
      input: path.join(sourceDir, "index.ts"),
      output: {
        banner: createBanner("remix", version),
        dir: path.join(outputDir, "esm"),
        format: "esm",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
          rootMode: "upward",
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
};
