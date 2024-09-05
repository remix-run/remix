const babel = require("@rollup/plugin-babel").default;
const copy = require("rollup-plugin-copy");
const fs = require("node:fs");
const fse = require("fs-extra");
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const path = require("node:path");

const REPO_ROOT_DIR = __dirname;

let activeOutputDir = "build";
if (process.env.LOCAL_BUILD_DIRECTORY) {
  let appDir = path.resolve(process.env.LOCAL_BUILD_DIRECTORY);
  try {
    fse.readdirSync(path.join(appDir, "node_modules"));
  } catch {
    console.error(
      "Oops! You pointed LOCAL_BUILD_DIRECTORY to a directory that " +
        "does not have a node_modules/ folder. Please `npm install` in that " +
        "directory and try again."
    );
    process.exit(1);
  }
  console.log("Writing rollup output to", appDir);
  activeOutputDir = appDir;
}

/**
 * @param {string} packageName
 * @param {string} version
 * @param {boolean} [executable]
 */
function createBanner(packageName, version, executable = false) {
  let banner = `/**
 * ${packageName} v${version}
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */`;
  return executable ? "#!/usr/bin/env node\n" + banner : banner;
}

/**
 * @param {string} packageDir
 */
function getVersion(packageDir) {
  return require(`./${packageDir}/package.json`).version;
}

/**
 * @param {string} id
 */
function isBareModuleId(id) {
  return !id.startsWith(".") && !path.isAbsolute(id);
}

/**
 * @param {string} appDir
 */
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

/**
 * @param {string} packageName
 * @returns {import("rollup").Plugin}
 */
function copyPublishFiles(packageName) {
  let sourceDir = `packages/${getPackageDirname(packageName)}`;
  let outputDir = getOutputDir(packageName);
  return copy({
    targets: [
      { src: "LICENSE.md", dest: [outputDir, sourceDir] },
      { src: `${sourceDir}/package.json`, dest: outputDir },
      { src: `${sourceDir}/README.md`, dest: outputDir },
      { src: `${sourceDir}/CHANGELOG.md`, dest: outputDir },
    ],
  });
}

/**
 * @returns {import("rollup").Plugin}
 */
function copyToPlaygrounds() {
  return {
    name: "copy-to-remix-playground",
    async writeBundle(options, bundle) {
      if (activeOutputDir === "build") {
        let playgroundsDir = path.join(REPO_ROOT_DIR, "playground");
        let playgrounds = await fs.promises.readdir(playgroundsDir);
        let writtenDir = path.join(REPO_ROOT_DIR, options.dir);
        for (let playground of playgrounds) {
          let playgroundDir = path.join(playgroundsDir, playground);
          if (!fse.statSync(playgroundDir).isDirectory()) {
            continue;
          }
          let destDir = writtenDir.replace(
            path.join(REPO_ROOT_DIR, "build"),
            playgroundDir
          );
          fse.copySync(writtenDir, destDir);
          await triggerLiveReload(playgroundDir);
        }
      } else {
        // Otherwise, trigger live reload on our LOCAL_BUILD_DIRECTORY folder
        await triggerLiveReload(activeOutputDir);
      }
    },
  };
}

/**
 * @param {RemixAdapter} adapterName
 * @returns {import("rollup").RollupOptions}
 */
function getAdapterConfig(adapterName) {
  /** @type {`@remix-run/${RemixAdapter}`} */
  let packageName = `@remix-run/${adapterName}`;
  let sourceDir = `packages/remix-${adapterName}`;
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");
  let version = getVersion(sourceDir);

  return {
    external(id) {
      return isBareModuleId(id);
    },
    input: `${sourceDir}/index.ts`,
    output: {
      banner: createBanner(packageName, version),
      dir: outputDist,
      format: "cjs",
      preserveModules: true,
      exports: "auto",
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts", ".tsx"],
      }),
      nodeResolve({ extensions: [".ts", ".tsx"] }),
      copyPublishFiles(packageName),
      copyToPlaygrounds(),
    ],
  };
}

/**
 * @param {{ packageName: string; version: string }} args
 * @returns {import("rollup").RollupOptions}
 */
function getCliConfig({ packageName, version }) {
  let sourceDir = `packages/${getPackageDirname(packageName)}`;
  let outputDir = getOutputDir(packageName);
  let outputDist = path.join(outputDir, "dist");
  return {
    external() {
      return true;
    },
    input: `${sourceDir}/cli.ts`,
    output: {
      banner: createBanner(packageName, version, true),
      dir: outputDist,
      format: "cjs",
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        exclude: /node_modules/,
        extensions: [".ts"],
      }),
      nodeResolve({ extensions: [".ts"] }),
      {
        name: "dynamic-import-polyfill",
        renderDynamicImport() {
          return {
            left: "import(",
            right: ")",
          };
        },
      },
      copyPublishFiles(packageName),
      copyToPlaygrounds(),
    ],
  };
}

/**
 * @param {string} packageName
 */
function getOutputDir(packageName) {
  return path.join(activeOutputDir, "node_modules", packageName);
}

/**
 * @param {string} packageName
 */
function getPackageDirname(packageName) {
  let scope = "@remix-run/";
  return packageName.startsWith(scope)
    ? `remix-${packageName.slice(scope.length)}`
    : packageName;
}

module.exports = {
  copyPublishFiles,
  copyToPlaygrounds,
  createBanner,
  getAdapterConfig,
  getCliConfig,
  getOutputDir,
  isBareModuleId,
};

/**
 * @typedef {"architect" | "cloudflare-pages" | "cloudflare-workers" | "express"} RemixAdapter
 * @typedef {"cloudflare" | "node" | "deno"} RemixRuntime
 * @typedef {`@remix-run/${RemixAdapter | RemixRuntime | "dev" | "eslint-config" | "react" | "serve" | "server-runtime"}`} ScopedRemixPackage
 * @typedef {"create-remix" | "remix" | ScopedRemixPackage} RemixPackage
 */
