const path = require("path");

const { getBuildInfo, index, magicExports } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  return [
    {
      ...index({ format: "cjs", ...buildInfo }),
      input: path.join(buildInfo.sourceDir, "index.tsx"),
    },
    {
      ...index({ format: "esm", ...buildInfo }),
      input: path.join(buildInfo.sourceDir, "index.tsx"),
    },
    magicExports({ format: "cjs", ...buildInfo }),
    magicExports({ format: "esm", ...buildInfo }),
  ];
};
