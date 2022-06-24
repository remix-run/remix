const copy = require("rollup-plugin-copy");

const { cli, getOutputDir } = require("../../rollup.utils");
const { name: packageName, version } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = "packages/create-remix";
  let outputDir = getOutputDir(packageName);
  let cliConfig = cli({ packageName, version });
  let plugins = cliConfig.plugins || [];
  let copyToPlaygroundsPlugin = [...plugins].pop();

  return [
    {
      ...cliConfig,
      plugins: [
        ...plugins.slice(0, -1),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        copyToPlaygroundsPlugin,
      ],
    },
  ];
};
