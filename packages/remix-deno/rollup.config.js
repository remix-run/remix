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
  let { packageRoot, sourceDir } = getBuildInfo(packageName);
  let copyTargets = [
    {
      src: path.join(REPO_ROOT_DIR, "LICENSE.md"),
      dest: packageRoot,
    },
  ];
  if (sourceDir !== packageRoot) {
    copyTargets.push({
      src: [
        path.join(sourceDir, "**", "*"),
        path.join(`!${sourceDir}`, "rollup.config.js"),
      ],
      dest: packageRoot,
    });
  }

  return [
    {
      input: path.join(sourceDir, ".empty.js"),
      plugins: [
        copy({ targets: copyTargets, gitignore: true }),
        copyToPlaygrounds(),
      ],
    },
  ];
};
