const path = require("path");
const copy = require("rollup-plugin-copy");

const { cli, getBuildInfo, REPO_ROOT_DIR } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  let { packageRoot } = getBuildInfo(packageName);
  let sourcePackageRoot = __dirname;
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

  let cliOptions = cli(buildInfo);
  let plugins = cliOptions.plugins || [];
  plugins.push(copy({ targets: copyTargets }));
  return [
    {
      ...cliOptions,
      plugins,
    },
  ];
};
