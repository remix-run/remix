/* eslint-disable import/no-extraneous-dependencies */
const path = require("path");
const copy = require("rollup-plugin-copy");

const { copyToPlaygrounds, getOutputDir } = require("../../rollup-utils");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = path.relative(process.cwd(), __dirname) || ".";
  let outputDir = getOutputDir("@remix-run/deno");

  return [
    {
      input: `${sourceDir}/.empty.js`,
      plugins: [
        copy({
          targets: [
            { src: `LICENSE.md`, dest: outputDir },
            {
              src: [`${sourceDir}/**/*`, `!${sourceDir}/rollup.config.js`],
              dest: outputDir,
            },
          ],
          gitignore: true,
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
};
