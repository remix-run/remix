const { index, getBuildInfo } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

// Re-export everything from this package that is available in `remix`
const magicExports = {
  "@remix-run/architect": {
    values: ["createArcTableSessionStorage"],
  },
  "@remix-run/node": {
    types: ["UploadHandler", "UploadHandlerPart"],
  },
};

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  return [index({ format: "cjs", magicExports, ...buildInfo })];
};
