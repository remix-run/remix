/* eslint-disable import/no-extraneous-dependencies */
const path = require("path");
const babel = require("@rollup/plugin-babel").default;
const copy = require("rollup-plugin-copy");

const {
  buildDir,
  copyToPlaygrounds,
  createBanner,
  getVersion,
} = require("../../rollup.utils");

let sourceDir = __dirname;
let packageName = "remix";

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let outputDir = path.join(buildDir, "node_modules", packageName);
  let version = getVersion(sourceDir);

  // Don't blow away remix magic exports on local builds, since they've
  // already been configured by postinstall
  if (process.env.LOCAL_BUILD_DIRECTORY) {
    return [];
  }

  return [
    {
      external() {
        return true;
      },
      input: `${sourceDir}/index.ts`,
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
        copy({
          targets: [
            { src: `LICENSE.md`, dest: outputDir },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        copyToPlaygrounds(),
      ],
    },
    {
      external() {
        return true;
      },
      input: `${sourceDir}/index.ts`,
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
