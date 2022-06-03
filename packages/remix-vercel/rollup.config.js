const { getAdapterConfig } = require("../../rollup.utils");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function remixServerAdapters() {
  return [...getAdapterConfig("vercel")];
};
