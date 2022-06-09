const { index } = require("../../rollup.utils");

let sourceDir = __dirname;
let packageName = "@remix-run/vercel";

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  return [
    index({ sourceDir, packageName, format: "cjs" }),
  ];
};
