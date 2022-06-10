const path = require("path");

const { cli, index } = require("../../rollup.utils");

let sourceDir = __dirname;
let packageName = "@remix-run/serve";

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  return [
    {
      ...index({ sourceDir, packageName, format: "cjs" }),
      input: [path.join(sourceDir, "index.ts"), path.join(sourceDir, "env.ts")],
    },
    cli({ sourceDir, packageName }),
  ];
};
