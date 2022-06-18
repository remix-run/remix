const { index, getBuildInfo, magicExports } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  return [
    index({ format: "cjs", ...buildInfo }),
    magicExports({ format: "cjs", ...buildInfo }),
    magicExports({ format: "esm", ...buildInfo }),
  ];
};
