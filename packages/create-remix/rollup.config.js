/* eslint-disable import/no-extraneous-dependencies */
const path = require("path");
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");

const {
  buildDir,
  copyToPlaygrounds,
  createBanner,
  executableBanner,
  getVersion,
} = require("../../rollup.utils");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = path.relative(process.cwd(), __dirname) || ".";
  let outputDir = path.join(buildDir, "node_modules/create-remix");
  let version = getVersion(sourceDir);

  return [
    {
      external(id) {
        // Cannot mark the input module as external
        return !id.endsWith(`${sourceDir}/cli.ts`);
      },
      input: `${sourceDir}/cli.ts`,
      output: {
        format: "cjs",
        dir: outputDir,
        banner: executableBanner + createBanner("create-remix", version),
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
          rootMode: "upward",
        }),
        nodeResolve({ extensions: [".ts"] }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: outputDir },
            { src: `${sourceDir}/package.json`, dest: outputDir },
            { src: `${sourceDir}/README.md`, dest: outputDir },
          ],
        }),
        copyToPlaygrounds(),
      ],
    },
  ];
};
