const fs = require("fs");
const path = require("path");
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");
const fse = require("fs-extra");

const EXECUTABLE_BANNER = "#!/usr/bin/env node\n";
const DEFAULT_BUILD_DIR = "build";
const REPO_ROOT_DIR = __dirname;
const PACKAGES_DIR = path.join(REPO_ROOT_DIR, "packages");
const buildDir = getBuildDir();

function getBuildDir() {
  if (!process.env.REMIX_LOCAL_BUILD_DIRECTORY) {
    return path.relative(
      process.cwd(),
      path.join(REPO_ROOT_DIR, DEFAULT_BUILD_DIR)
    );
  }
  let appDir = path.resolve(
    REPO_ROOT_DIR,
    process.env.REMIX_LOCAL_BUILD_DIRECTORY
  );
  try {
    fse.readdirSync(path.join(appDir, "node_modules"));
    return appDir;
  } catch (e) {
    console.error(
      "Oops! You pointed `REMIX_LOCAL_BUILD_DIRECTORY` to a directory that " +
        "does not have a `node_modules/` folder. Please `npm install` in that " +
        "directory and try again."
    );
    process.exit(1);
  }
}

function createBanner(packageName, version) {
  return `/**
 * ${packageName} v${version}
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */`;
}

function getVersion(packageDir) {
  return require(`${packageDir}/package.json`).version;
}

function isBareModuleId(id) {
  return !id.startsWith(".") && !path.isAbsolute(id);
}

async function triggerLiveReload(appDir) {
  // Tickle live reload by touching the server entry
  // Consider all of entry.server.{tsx,ts,jsx,js} since React may be used
  // via `React.createElement` without the need for JSX.
  let serverEntryPaths = [
    "entry.server.ts",
    "entry.server.tsx",
    "entry.server.js",
    "entry.server.jsx",
  ];
  let serverEntryPath = serverEntryPaths
    .map((entryFile) => path.join(appDir, "app", entryFile))
    .find((entryPath) => fse.existsSync(entryPath));
  if (serverEntryPath) {
    let date = new Date();
    await fs.promises.utimes(serverEntryPath, date, date);
  }
}

function copyToPlaygrounds() {
  return {
    name: "copy-to-remix-playground",
    async writeBundle(options, bundle) {
      // Write to playgrounds for normal builds not using REMIX_LOCAL_BUILD_DIRECTORY
      if (!process.env.REMIX_LOCAL_BUILD_DIRECTORY) {
        let playgroundsDir = path.join(REPO_ROOT_DIR, "playground");
        let playgrounds = await fs.promises.readdir(playgroundsDir);
        let writtenDir = path.join(
          process.cwd(),
          options.dir || path.dirname(options.file)
        );
        for (let playground of playgrounds) {
          let playgroundDir = path.join(playgroundsDir, playground);
          if (!fse.statSync(playgroundDir).isDirectory()) {
            continue;
          }
          let destDir = writtenDir.replace(
            path.join(REPO_ROOT_DIR, "build"),
            playgroundDir
          );
          await fse.copy(writtenDir, destDir);
          await triggerLiveReload(playgroundDir);
        }
      } else {
        // Otherwise, trigger live reload on our REMIX_LOCAL_BUILD_DIRECTORY folder
        await triggerLiveReload(buildDir);
      }
    },
  };
}

/**
 * @param {BuildInfo & { format: "cjs" | "esm" }} buildInfo
 * @returns {import("rollup").RollupOptions} Default Rollup configuration for `<sourceDir>/index.ts`
 */
function index({
  format,
  outputDir,
  packageName,
  packageRoot,
  sourceDir,
  version,
}) {
  let sourcePackageRoot = getPackageRoot(packageName);
  let copyTargets = [
    { src: path.join(REPO_ROOT_DIR, "LICENSE.md"), dest: packageRoot },
  ];
  if (sourcePackageRoot !== packageRoot) {
    copyTargets.push({
      src: path.join(sourcePackageRoot, "package.json"),
      dest: packageRoot,
    });
    copyTargets.push({
      src: path.join(sourcePackageRoot, "CHANGELOG.md"),
      dest: packageRoot,
    });
    copyTargets.push({
      src: path.join(sourcePackageRoot, "README.md"),
      dest: packageRoot,
    });
  }
  return {
    external: (id) => isBareModuleId(id),
    input: path.join(sourceDir, "index.ts"),
    output: {
      banner: createBanner(packageName, version),
      dir: format === "cjs" ? outputDir : path.join(outputDir, format),
      format,
      preserveModules: true,
      exports: "named",
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
        rootMode: "upward",
      }),
      nodeResolve({ extensions: [".ts", ".tsx"] }),
      copy({ targets: copyTargets }),
      copyToPlaygrounds(),
    ],
  };
}

/**
 * @param {BuildInfo} buildInfo
 * @returns {import("rollup").RollupOptions} Default Rollup configuration for `<sourceDir>/cli.ts`
 */
function cli({ outputDir, packageName, sourceDir, version }) {
  let packageRoot = getPackageRoot(packageName);
  return {
    external: (id) => !id.endsWith(path.join(sourceDir, "cli.ts")),
    input: path.join(sourceDir, "cli.ts"),
    output: {
      format: "cjs",
      dir: outputDir,
      banner: EXECUTABLE_BANNER + createBanner(packageName, version),
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
          { src: "LICENSE.md", dest: packageRoot },
          //   { src: path.join(sourceDir, "package.json"), dest: outputDir },
          //   { src: path.join(sourceDir, "README.md"), dest: outputDir },
        ],
      }),
      copyToPlaygrounds(),
    ],
  };
}

/**
 * @deprecated New packages should not provide magic exports
 * @param {BuildInfo & { format: "cjs" | "esm" }} buildInfo
 * @returns {import("rollup").RollupOptions} Default Rollup configuration for `<sourceDir>/magicExports/remix.ts`
 */
function magicExports({ format, outputDir, packageName, sourceDir, version }) {
  return {
    external: () => true,
    input: path.join(sourceDir, "magicExports", "remix.ts"),
    output: {
      banner: createBanner(packageName, version),
      dir: path.join(
        outputDir,
        "magicExports",
        ...(format === "cjs" ? [] : [format])
      ),
      format,
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
        rootMode: "upward",
      }),
      copyToPlaygrounds(),
    ],
  };
}

/**
 * @param {string} packageName
 * @returns {string}
 */
function getPackageRoot(packageName) {
  let scope = "@remix-run";
  return packageName.startsWith(`${scope}/`)
    ? path.join(PACKAGES_DIR, `remix-${packageName.slice(scope.length + 1)}`)
    : path.join(PACKAGES_DIR, packageName);
}

/**
 * Determine the relevant information for a rollup build, relative to the
 * current working directory and taking `REMIX_LOCAL_BUILD_DIRECTORY` into
 * account.
 *
 * @param {string} packageName npm package name (i.e., `@remix-run/react`)
 * @returns {BuildInfo} Object with the build directories
 *   - `outputDir`: Destination directory to write rollup output to
 *   - `packageName`: npm package name (i.e., `@remix-run/react`)
 *   - `packageRoot`: Destination package root directory
 *   - `sourceDir`: Source package directory we will read input files from
 *   - `version`: npm package version
 */
function getBuildInfo(packageName) {
  let packageRoot = getPackageRoot(packageName);
  let version = getVersion(packageRoot);
  let sourceDir = packageRoot;
  let outputDir = path.join(packageRoot, "dist");
  if (process.env.REMIX_LOCAL_BUILD_DIRECTORY) {
    let nodeModulesDir = path.join(packageRoot, "node_modules");
    packageRoot = path.join(nodeModulesDir, ...packageName.split("/"));
    outputDir = path.join(packageRoot, "dist");
  }
  return {
    outputDir,
    packageName,
    packageRoot,
    sourceDir,
    version,
  };
}

module.exports = {
  buildDir,
  cli,
  copyToPlaygrounds,
  createBanner,
  EXECUTABLE_BANNER,
  getBuildInfo,
  getVersion,
  index,
  isBareModuleId,
  magicExports,
  REPO_ROOT_DIR,
};

/**
 * @typedef {{
 *   outputDir: string;
 *   packageName: string;
 *   packageRoot: string;
 *   sourceDir: string;
 *   version: string;
 * }} BuildInfo
 */
