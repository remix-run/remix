const { index, magicExports } = require("../../rollup.utils");

let sourceDir = __dirname;
let packageName = "@remix-run/node";

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  return [
    index({ sourceDir, packageName, format: "cjs" }),
    magicExports({ sourceDir, packageName, format: "cjs" }),
    magicExports({ sourceDir, packageName, format: "esm" }),
  ];
};
