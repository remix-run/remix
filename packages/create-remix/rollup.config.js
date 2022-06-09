const { cli } = require("../../rollup.utils");

let sourceDir = __dirname;
let packageName = "create-remix";

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  return [cli({ sourceDir, packageName })];
};
