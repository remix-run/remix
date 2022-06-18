const path = require("path");

const { cli, getBuildInfo, index } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  return [
    {
      ...index({ format: "cjs", ...buildInfo }),
      input: [
        path.join(buildInfo.sourceDir, "index.ts"),
        path.join(buildInfo.sourceDir, "env.ts"),
      ],
    },
    cli(buildInfo),
  ];
};
