const path = require("path");
const babel = require("@rollup/plugin-babel").default;
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
  let sourcePackageRoot = __dirname;
  let copyTargets = [
    {
      src: path.join(REPO_ROOT_DIR, "LICENSE.md"),
      dest: packageRoot,
    },
    {
      src: path.join(sourceDir, "compiler", "shims"),
      dest: path.join(outputDir, "compiler"),
    },
  ];

  if (sourcePackageRoot !== packageRoot) {
    copyTargets.push({
      src: path.join(sourceDir, "package.json"),
      dest: packageRoot,
    });
    copyTargets.push({
      src: path.join(sourceDir, "CHANGELOG.md"),
      dest: packageRoot,
    });
    copyTargets.push({
      src: path.join(sourceDir, "README.md"),
      dest: packageRoot,
    });
  }

  return [
    {
      external(id, parent) {
        if (
          id === "../package.json" &&
          parent === path.resolve(sourceDir, path.join("cli", "create.ts"))
        ) {
          return true;
        }
        return isBareModuleId(id);
      },
      input: path.join(sourceDir, "index.ts"),
      output: {
        banner: createBanner(packageName, version),
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
        copy({ targets: copyTargets }),
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
        dir: path.join(outputDir, "cli", "migrate", "migrations"),
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
