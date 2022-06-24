const path = require("path");
const babel = require("@rollup/plugin-babel").default;
const json = require("@rollup/plugin-json");
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");

const {
  cli,
  copyToPlaygrounds,
  createBanner,
  EXECUTABLE_BANNER,
  getBuildInfo,
  isBareModuleId,
  REPO_ROOT_DIR,
} = require("../../rollup.utils");
const { name: packageName, version } = require("./package.json");

/** @returns {import("rollup").RollupOptions[]} */
module.exports = function rollup() {
  let buildInfo = getBuildInfo(packageName);
  let { outputDir, packageRoot, sourceDir } = buildInfo;
  let outputDist = path.join(outputDir, "dist");

  return [
    {
      external: isBareModuleId,
      input: path.join(sourceDir, "index.ts"),
      output: {
        banner: createBanner(packageName, version),
        dir: outputDist,
        format: "cjs",
        preserveModules: true,
        exports: "named",
      },
      plugins: [
        json(),
        babel({
          babelHelpers: "bundled",
          exclude: /node_modules/,
          extensions: [".ts"],
          rootMode: "upward",
        }),
        nodeResolve({ extensions: [".ts"] }),
        copy({
          targets: [
            {
              src: path.join(REPO_ROOT_DIR, "LICENSE.md"),
              dest: [packageRoot, outputDir],
            },
            {
              src: path.join(sourceDir, "compiler", "shims"),
              dest: [
                path.join(outputDir, "compiler"),
                path.join(outputDist, "compiler"),
              ],
            },
            {
              src: path.join(sourceDir, "package.json"),
              dest: [outputDir, outputDist],
            },
            {
              src: path.join(sourceDir, "CHANGELOG.md"),
              dest: outputDir,
            },
            {
              src: path.join(sourceDir, "README.md"),
              dest: outputDir,
            },
          ],
        }),
        // Allow dynamic imports in CJS code to allow us to utilize ESM modules
        // as part of the compiler.
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
    cli(buildInfo),
    {
      external: (id) => isBareModuleId(id),
      input: path.join(
        sourceDir,
        "cli",
        "migrate",
        "migrations",
        "transforms.ts"
      ),
      output: {
        banner: createBanner(packageName, version),
        dir: path.join(outputDist, "cli", "migrate", "migrations"),
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
        return !id.endsWith(path.join(sourceDir, "server-build.ts"));
      },
      input: path.join(sourceDir, "server-build.ts"),
      output: {
        banner: EXECUTABLE_BANNER + createBanner(packageName, version),
        dir: outputDist,
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
