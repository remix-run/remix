const path = require("path");
const copy = require("rollup-plugin-copy");

const { cli, getBuildInfo, REPO_ROOT_DIR } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  let sourceDir = __dirname;
  let buildDir = buildInfo.outputDir;
  let cliOptions = cli(buildInfo);
  let plugins = cliOptions.plugins || [];
  plugins.push(
    copy({
      targets: [
        {
          src: path.join(REPO_ROOT_DIR, "LICENSE.md"),
          dest: [sourceDir, buildDir],
        },
        {
          src: path.join(sourceDir, "package.json"),
          dest: buildDir,
        },
        {
          src: path.join(sourceDir, "CHANGELOG.md"),
          dest: buildDir,
        },
        {
          src: path.join(sourceDir, "README.md"),
          dest: buildDir,
        },
      ],
    })
  );
  return [{ ...cliOptions, plugins }];
};
