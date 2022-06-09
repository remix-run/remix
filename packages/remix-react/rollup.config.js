const { index, magicExports } = require("../../rollup.utils");

let sourceDir = __dirname;
let packageName = "@remix-run/react";

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  return [
    {
      ...index({ sourceDir, packageName, format: "cjs" }),
      input: `${sourceDir}/index.tsx`,
    },
    {
      ...index({ sourceDir, packageName, format: "esm" }),
      input: `${sourceDir}/index.tsx`,
    },
    magicExports({ sourceDir, packageName, format: "cjs" }),
    magicExports({ sourceDir, packageName, format: "esm" }),
  ];
};
