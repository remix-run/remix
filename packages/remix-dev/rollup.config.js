const path = require("path");
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");

const {
  copyToPlaygrounds,
  createBanner,
  getCliConfig,
  getOutputDir,
  isBareModuleId,
} = require("../../rollup.utils");
const { name: packageName, version } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let sourceDir = "packages/remix-dev";
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");

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
        dir: outputDist,
        format: "cjs",
        preserveModules: true,
        exports: "named",
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        nodeResolve({ extensions: [".ts"] }),
        copy({
          targets: [
            { src: `LICENSE.md`, dest: [outputDir, sourceDir] },
            { src: `${sourceDir}/package.json`, dest: [outputDir, outputDist] },
            { src: `${sourceDir}/README.md`, dest: outputDir },
            {
              src: `${sourceDir}/compiler/shims`,
              dest: [`${outputDir}/compiler`, `${outputDist}/compiler`],
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
    getCliConfig({ packageName, version }),
    {
      external: (id) => isBareModuleId(id),
      input: [`${sourceDir}/cli/migrate/migrations/transforms.ts`],
      output: {
        banner: createBanner("@remix-run/dev", version),
        dir: `${outputDist}/cli/migrate/migrations`,
        exports: "named",
        format: "cjs",
        preserveModules: true,
      },
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        nodeResolve({ extensions: [".ts"] }),
        copyToPlaygrounds(),
      ],
    },
    {
      external() {
        return true;
      },
      input: `${sourceDir}/server-build.ts`,
      output: [
        {
          // TODO: Remove deep import support in v2 or move to package.json
          // "exports" field
          banner: createBanner("@remix-run/dev", version, true),
          dir: outputDir,
          format: "cjs",
        },
        {
          banner: createBanner("@remix-run/dev", version, true),
          dir: outputDist,
          format: "cjs",
        },
      ],
      plugins: [
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
        }),
        nodeResolve({ extensions: [".ts"] }),
        copyToPlaygrounds(),
      ],
    },
  ];
};
