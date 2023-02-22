const { getAdapterConfig } = require("../../rollup.utils");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  return [getAdapterConfig("vercel"), getAdapterConfig("vercel", "edge.ts")];
};
