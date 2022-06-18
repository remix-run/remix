/* eslint-disable no-restricted-globals */
const { getBuildInfo, index, magicExports } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  return [
    index({ format: "cjs", ...buildInfo }),
    index({ format: "esm", ...buildInfo }),
    magicExports({ format: "cjs", ...buildInfo }),
    magicExports({ format: "esm", ...buildInfo }),
  ];
};
