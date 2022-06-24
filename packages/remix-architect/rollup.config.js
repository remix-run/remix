const { getAdapterConfig } = require("../../rollup.utils");

// Re-export everything from this package that is available in `remix`
/** @type {import('../../rollup.utils').MagicExports} */
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
  return [getAdapterConfig("architect", magicExports)];
};
