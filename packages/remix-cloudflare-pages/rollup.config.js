const path = require("node:path");
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;

const {
  copyToPlaygrounds,
  createBanner,
  getAdapterConfig,
  getOutputDir,
  isBareModuleId,
} = require("../../rollup.utils");
const { name: packageName, version } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = "packages/remix-cloudflare-pages";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");

  return [
    {
      external(id) {
        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner("@remix-run/cloudflare-pages", version),
        dir: `${outputDist}/esm`,
        format: "esm",
        preserveModules: true,
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts", ".tsx"],
        }),
        nodeResolve({ extensions: [".ts", ".tsx"] }),
        copyToPlaygrounds(),
      ],
    },
    getAdapterConfig("cloudflare-pages"),
  ];
};
