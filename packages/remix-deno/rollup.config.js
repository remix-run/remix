// deno-lint-ignore-file
const path = require("path");
const copy = require("rollup-plugin-copy");

const {
  copyToPlaygrounds,
  getBuildInfo,
  REPO_ROOT_DIR,
} = require("../../rollup.utils");
let { name: packageName } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let { outputDir } = getBuildInfo(packageName);
  let sourceDir = __dirname;

  return [
    {
      input: path.join(sourceDir, ".empty.js"),
      watch: {
        // Suppress the "you must provide an output directory" warning when
        // running in watch mode since we don't care to write the empty bundle
        skipWrite: true,
      },
      plugins: [
        copy({
          targets: [
            {
              src: path.join(REPO_ROOT_DIR, "LICENSE.md"),
              dest: [sourceDir, outputDir],
            },
            {
              src: path.join(sourceDir, "package.json"),
              dest: outputDir,
            },
            {
              src: path.join(sourceDir, "CHANGELOG.md"),
              dest: outputDir,
            },
            {
              src: path.join(sourceDir, "README.md"),
              dest: outputDir,
            },
            {
              src: [
                path.join(sourceDir, "**", "*"),
                "!" + path.join(sourceDir, "rollup.config.*"),
              ],
              dest: outputDir,
            },
          ],
          gitignore: true,
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
};
