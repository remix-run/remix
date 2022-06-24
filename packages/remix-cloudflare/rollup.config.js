const { getBuildInfo, index } = require("../../rollup.utils");
const { name: packageName } = require("./package.json");

// Re-export everything from this package that is available in `remix`
const magicExports = {
  values: {
    "@remix-run/cloudflare": [
      "createCloudflareKVSessionStorage",
      "createCookie",
      "createCookieSessionStorage",
      "createMemorySessionStorage",
      "createSessionStorage",
    ],
  },
};

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  return [index({ format: "cjs", magicExports, ...buildInfo })];
};
