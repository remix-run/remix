// deno-lint-ignore-file
const copy = require("rollup-plugin-copy");

const { getOutputDir, copyToPlaygrounds } = require("../../rollup.utils");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = "packages/remix-deno";
  let outputDir = getOutputDir("@remix-run/deno");

  return [
    {
      input: `${sourceDir}/.empty.js`,
      plugins: [
        copy({
          targets: [
            { src: "LICENSE.md", dest: [outputDir, sourceDir] },
            {
              src: [
                `${sourceDir}/**/*`,
                `!${sourceDir}/rollup.config.js`,
                `!${sourceDir}/node_modules`,
              ],
              dest: outputDir,
            },
          ],
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
};
