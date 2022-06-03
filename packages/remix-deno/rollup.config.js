/* eslint-disable import/no-extraneous-dependencies */
const path = require("path");
const copy = require("rollup-plugin-copy");

const { buildDir, copyToPlaygrounds } = require("../../rollup-utils");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = path.relative(process.cwd(), __dirname) || ".";
  let outputDir = path.join(buildDir, "node_modules/@remix-run/deno");

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
