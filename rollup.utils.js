const fs = require("fs");
const path = require("path");
const babel = require("@rollup/plugin-babel").default;
const nodeResolve = require("@rollup/plugin-node-resolve").default;
const copy = require("rollup-plugin-copy");
const fse = require("fs-extra");
const { camelCase } = require("lodash");

const EXECUTABLE_BANNER = "#!/usr/bin/env node\n";
const REPO_ROOT_DIR = __dirname;
const PACKAGES_DIR = path.join(REPO_ROOT_DIR, "packages");
const buildDir = getBuildDir();

function getBuildDir() {
  if (!process.env.REMIX_LOCAL_BUILD_DIRECTORY) {
    return path.join(REPO_ROOT_DIR, "build");
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

/**
 * @param {string} packageName
 * @param {string} version
 * @returns
 */
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

/**
 * @param {string} packageDir
 */
function getVersion(packageDir) {
  return require(`${packageDir}/package.json`).version;
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
 *
 * @returns {import("rollup").Plugin}
 */
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
          options.dir || path.dirname(options.file || "")
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
 * @param {BuildInfo & { format: "cjs" | "esm"; magicExports?: MagicExports }} buildInfo
 * @returns {import("rollup").RollupOptions} Default Rollup configuration for `<sourceDir>/index.ts`
 */
function index({
  format,
  outputDir,
  packageName,
  packageRoot,
  sourceDir,
  version,
  magicExports,
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
      // @ts-ignore
      copy({ targets: copyTargets }),
      copyToPlaygrounds(),
      magicExportsPlugin(magicExports, { packageName, version }),
    ].filter(Boolean),
  };
}

/**
 * @param {MagicExports | undefined} magicExports
 * @param {Pick<BuildInfo, 'packageName' | 'version'>} buildInfo
 * @returns {import("rollup").Plugin}
 */
function magicExportsPlugin(magicExports, { packageName, version }) {
  return {
    name: `${packageName}:generate-magic-exports`,
    generateBundle() {
      if (!magicExports) return;

      let typings = "";
      let esm = "";
      let cjs = "";

      if (magicExports.vars) {
        let banner = createBanner(packageName, version);
        for (let pkgName of Object.keys(magicExports.vars)) {
          // esm contents
          if (!esm) {
            esm = banner + "\n";
          }
          let exportList = magicExports.vars[pkgName].join(", ");
          esm += `export { ${exportList} } from '${pkgName}';\n`;
          typings += `export { ${exportList} } from '${pkgName}';\n`;

          // cjs contents
          if (!cjs) {
            cjs =
              banner +
              "\n" +
              "'use strict';\n" +
              "Object.defineProperty(exports, '__esModule', { value: true });\n";
          }
          let varName = camelCase(
            pkgName.startsWith("@remix-run/") ? pkgName.slice(11) : pkgName
          );

          cjs += `var ${varName} = require('${pkgName}');\n`;
          for (let symbol of magicExports.vars[pkgName]) {
            cjs +=
              `Object.defineProperty(exports, '${symbol}', {\n` +
              "  enumerable: true,\n" +
              `  get: function () { return ${varName}.${symbol}; }\n` +
              "});\n";
          }
        }
      }

      if (magicExports.types) {
        for (let pkgName of Object.keys(magicExports.types)) {
          let exportList = magicExports.types[pkgName].join(", ");
          typings += `export type { ${exportList} } from '${pkgName}';\n`;
        }
      }

      typings &&
        this.emitFile({
          type: "asset",
          fileName: "magicExports/remix.d.ts",
          source: typings,
        });

      cjs &&
        this.emitFile({
          type: "asset",
          fileName: "magicExports/remix.js",
          source: cjs,
        });

      esm &&
        this.emitFile({
          type: "asset",
          fileName: "magicExports/esm/remix.js",
          source: esm,
        });
    },
  };
}

/**
 * @param {BuildInfo} buildInfo
 * @returns {import("rollup").RollupOptions} Default Rollup configuration for `<sourceDir>/cli.ts`
 */
function cli({ outputDir, packageName, sourceDir, version }) {
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
    let nodeModulesDir = path.join(buildDir, "node_modules");
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
 *
 * @typedef {{
 *   vars?: Record<string, string[]>;
 *   types?: Record<string, string[]>;
 * }} MagicExports
 */
