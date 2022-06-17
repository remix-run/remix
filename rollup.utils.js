const fs = require("fs");
const path = require("path");
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");
const fse = require("fs-extra");

const executableBanner = "#!/usr/bin/env node\n";
const defaultBuildDir = "build";
const buildDir = getBuildDir();
const packagesDir = path.join(__dirname, "packages");

function getBuildDir() {
  if (!process.env.REMIX_LOCAL_BUILD_DIRECTORY) {
    return path.relative(process.cwd(), path.join(__dirname, defaultBuildDir));
  }

  let appDir = path.join(
    process.cwd(),
    process.env.REMIX_LOCAL_BUILD_DIRECTORY
  );
  try {
    fse.readdirSync(path.join(appDir, "node_modules"));
    console.log("Writing rollup output to", appDir);
    return appDir;
  } catch (e) {
    console.error(
      "Oops! You pointed REMIX_LOCAL_BUILD_DIRECTORY to a directory that " +
        "does not have a node_modules/ folder. Please `npm install` in that " +
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
        let playgroundsDir = path.join(__dirname, "playground");
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
            path.join(__dirname, "build"),
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
 * @param {{
 *  sourceDir: string
 *  packageName: string
 *  format: "cjs" | "esm"
 * }} args
 * @returns {import("rollup").RollupOptions} Default Rollup configuration for `<sourceDir>/index.ts`
 */
function index({ sourceDir, packageName, format }) {
  let version = getVersion(sourceDir);
  let outputDir = getOutputDir(packagesDir);
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
      copy({
        targets: [
          { src: "LICENSE.md", dest: outputDir },
          { src: path.join(sourceDir, "package.json"), dest: outputDir },
          { src: path.join(sourceDir, "README.md"), dest: outputDir },
        ],
      }),
      copyToPlaygrounds(),
    ],
  };
}

/**
 * @param {{
 *  sourceDir: string
 *  packageName: string
 * }} args
 * @returns {import("rollup").RollupOptions} Default Rollup configuration for `<sourceDir>/cli.ts`
 */
function cli({ sourceDir, packageName }) {
  let version = getVersion(sourceDir);
  let outputDir = getOutputDir(packagesDir);
  return {
    external: (id) => !id.endsWith(path.join(sourceDir, "cli.ts")),
    input: path.join(sourceDir, "cli.ts"),
    output: {
      format: "cjs",
      dir: outputDir,
      banner: executableBanner + createBanner(packageName, version),
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
          { src: "LICENSE.md", dest: outputDir },
          { src: path.join(sourceDir, "package.json"), dest: outputDir },
          { src: path.join(sourceDir, "README.md"), dest: outputDir },
        ],
      }),
      copyToPlaygrounds(),
    ],
  };
}

/**
 * @deprecated New packages should not provide magic exports
 * @param {{
 *  sourceDir: string
 *  packageName: string
 *  format: "cjs" | "esm"
 * }} args
 * @returns {import("rollup").RollupOptions} Default Rollup configuration for `<sourceDir>/magicExports/remix.ts`
 */
function magicExports({ sourceDir, packageName, format }) {
  let version = getVersion(sourceDir);
  let outputDir = getOutputDir(packagesDir);
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
  return packageName.startsWith("@remix-run/")
    ? path.join(packagesDir, `remix-${packageName.slice(11)}`)
    : path.join(packagesDir, packageName);
}

/**
 * @param {string} packageName
 * @returns {string}
 */
function getOutputDir(packageName) {
  if (packageName === "dev") {
    let packageRoot = getPackageRoot(packageName);
    return path.join(packageRoot, "dist");
  }
  return path.join(
    buildDir,
    "node_modules",
    packageName.replace("/", path.sep)
  );
}

/**
 * Determine the relevant directories for a rollup build, relative to the
 * current working directory and taking REMIX_LOCAL_BUILD_DIRECTORY into account
 *
 * ROOT_DIR     Root directory for the react-router repo SOURCE_DIR   Source
 * package directory we will read input files from OUTPUT_DIR   Destination
 * directory to write rollup output to
 *
 * @param {string} packageName  npm package name (i.e., @remix-run/router)
 * @param {string} [folderName] folder name (i.e., router). Defaults to package name
 */
function getBuildDirectories(packageName, folderName) {
  let ROOT_DIR = __dirname;
  let SOURCE_DIR = folderName
    ? path.join(packagesDir, folderName)
    : getPackageRoot(packageName);

  // Update if we're not running from root
  if (process.cwd() !== __dirname) {
    ROOT_DIR = path.dirname(path.dirname(process.cwd()));
    SOURCE_DIR = process.cwd();
  }

  let OUTPUT_DIR = path.join(SOURCE_DIR, "dist");

  if (process.env.REMIX_LOCAL_BUILD_DIRECTORY) {
    try {
      let nodeModulesDir = path.join(
        process.cwd(),
        process.env.REMIX_LOCAL_BUILD_DIRECTORY,
        "node_modules"
      );
      fse.readdirSync(nodeModulesDir);
      OUTPUT_DIR = path.join(nodeModulesDir, ...packageName.split("/"), "dist");
    } catch (e) {
      console.error(
        "Oops! You pointed REMIX_LOCAL_BUILD_DIRECTORY to a directory that " +
          "does not have a node_modules/ folder. Please `npm install` in that " +
          "directory and try again."
      );
      process.exit(1);
    }
  }

  return { ROOT_DIR, SOURCE_DIR, OUTPUT_DIR };
}

module.exports = {
  buildDir,
  cli,
  copyToPlaygrounds,
  createBanner,
  defaultBuildDir,
  executableBanner,
  getBuildDirectories,
  getVersion,
  index,
  isBareModuleId,
  magicExports,
};
