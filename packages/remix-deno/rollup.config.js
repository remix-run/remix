const path = require("path");
const copy = require("rollup-plugin-copy");

const { buildDir, copyToPlaygrounds } = require("../../rollup.utils");

let sourceDir = __dirname;
let packageName = "@remix-run/deno";

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let outputDir = path.join(buildDir, `node_modules/${packageName}`);

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
