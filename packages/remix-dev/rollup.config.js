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
  isBareModuleId,
} = require("../../rollup-utils");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = path.relative(process.cwd(), __dirname) || ".";
  let outputDir = path.join(buildDir, "node_modules/@remix-run/dev");
  let version = getVersion(sourceDir);

  return [
    {
      external(id, parent) {
        if (
          id === "../package.json" &&
          parent === path.resolve(__dirname, "cli/create.ts")
        ) {
          return true;
        }

        return isBareModuleId(id);
      },
      input: `${sourceDir}/index.ts`,
      output: {
        banner: createBanner("@remix-run/dev", version),
        dir: outputDir,
        format: "cjs",
        preserveModules: true,
        exports: "named",
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
            {
              src: `${sourceDir}/compiler/shims`,
              dest: `${outputDir}/compiler`,
            },
          ],
        }),
        // Allow dynamic imports in CJS code to allow us to utilize
        // ESM modules as part of the compiler.
        {
          name: "dynamic-import-polyfill",
          renderDynamicImport() {
            return {
              left: "import(",
              right: ")",
            };
          },
        },
        copyToPlaygrounds(),
      ],
    },
    {
      external(id) {
        // Cannot mark the input module as external
        return !id.endsWith(`${sourceDir}/cli.ts`);
      },
      input: `${sourceDir}/cli.ts`,
      output: {
        banner: executableBanner + createBanner("@remix-run/dev", version),
        dir: outputDir,
        format: "cjs",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
          rootMode: "upward",
        }),
        nodeResolve({ extensions: [".ts"] }),
        copyToPlaygrounds(),
      ],
    },
    {
      external: (id) => isBareModuleId(id),
      input: [`${sourceDir}/cli/migrate/migrations/transforms.ts`],
      output: {
        banner: createBanner("@remix-run/dev", version),
        dir: `${outputDir}/cli/migrate/migrations`,
        exports: "named",
        format: "cjs",
        preserveModules: true,
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
          rootMode: "upward",
        }),
        nodeResolve({ extensions: [".ts"] }),
        copyToPlaygrounds(),
      ],
    },
    {
      external(id) {
        // Cannot mark the input module as external
        return !id.endsWith(`${sourceDir}/server-build.ts`);
      },
      input: `${sourceDir}/server-build.ts`,
      output: {
        banner: executableBanner + createBanner("@remix-run/dev", version),
        dir: outputDir,
        format: "cjs",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
          rootMode: "upward",
        }),
        nodeResolve({ extensions: [".ts"] }),
        copyToPlaygrounds(),
      ],
    },
  ];
};
