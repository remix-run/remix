const fsp = require("node:fs").promises;
const chalk = require("chalk");
const path = require("node:path");
const { execSync } = require("node:child_process");
const jsonfile = require("jsonfile");
const Confirm = require("prompt-confirm");

let rootDir = path.resolve(__dirname, "..");

let remixPackages = {
  adapters: ["architect", "cloudflare-pages", "cloudflare-workers", "express"],
  runtimes: ["cloudflare", "deno", "node"],
  core: [
    "dev",
    "server-runtime",
    "react",
    "fs-routes",
    "route-config",
    "routes-option-adapter",
    "eslint-config",
    "css-bundle",
    "testing",
  ],
  get all() {
    return [...this.adapters, ...this.runtimes, ...this.core, "serve"];
  },
};

/**
 * @param {string} packageName
 * @param {string} [directory]
 * @returns {string}
 */
function packageJson(packageName, directory = "") {
  return path.join(rootDir, directory, packageName, "package.json");
}

/**
 * @param {string} packageName
 * @returns {Promise<string | undefined>}
 */
async function getPackageVersion(packageName) {
  let file = packageJson(packageName, "packages");
  let json = await jsonfile.readFile(file);
  return json.version;
}

/**
 * @returns {void}
 */
function ensureCleanWorkingDirectory() {
  let status = execSync(`git status --porcelain`).toString().trim();
  let lines = status.split("\n");
  if (!lines.every((line) => line === "" || line.startsWith("?"))) {
    console.error(
      "Working directory is not clean. Please commit or stash your changes."
    );
    process.exit(1);
  }
}

/**
 * @param {string} question
 * @returns {Promise<string | boolean>}
 */
async function prompt(question) {
  let confirm = new Confirm(question);
  let answer = await confirm.run();
  return answer;
}

/**
 * @param {string} packageName
 * @param {(json: import('type-fest').PackageJson) => any} transform
 */
async function updatePackageConfig(packageName, transform) {
  let file = packageJson(packageName, "packages");
  try {
    let json = await jsonfile.readFile(file);
    if (!json) {
      console.log(`No package.json found for ${packageName}; skipping`);
      return;
    }
    transform(json);
    await jsonfile.writeFile(file, json, { spaces: 2 });
  } catch {
    return;
  }
}

/**
 * @param {string} packageName
 * @param {string} nextVersion
 * @param {string} [successMessage]
 */
async function updateRemixVersion(packageName, nextVersion, successMessage) {
  await updatePackageConfig(packageName, (config) => {
    config.version = nextVersion;
  });
  let logName = packageName.startsWith("remix-")
    ? `@remix-run/${packageName.slice(6)}`
    : packageName;
  console.log(
    chalk.green(
      `  ${
        successMessage ||
        `Updated ${chalk.bold(logName)} to version ${chalk.bold(nextVersion)}`
      }`
    )
  );
}

/**
 * @param {string} importSpecifier
 * @returns {[string, string]} [packageName, importPath]
 */
const getPackageNameFromImportSpecifier = (importSpecifier) => {
  if (importSpecifier.startsWith("@")) {
    let [scope, pkg, ...path] = importSpecifier.split("/");
    return [`${scope}/${pkg}`, path.join("/")];
  }

  let [pkg, ...path] = importSpecifier.split("/");
  return [pkg, path.join("/")];
};
/**
 * @param {string} importMapPath
 * @param {string} nextVersion
 */
const updateDenoImportMap = async (importMapPath, nextVersion) => {
  let { imports, ...json } = await jsonfile.readFile(importMapPath);
  let remixPackagesFull = remixPackages.all.map(
    (remixPackage) => `@remix-run/${remixPackage}`
  );

  let newImports = Object.fromEntries(
    Object.entries(imports).map(([importName, path]) => {
      let [packageName, importPath] =
        getPackageNameFromImportSpecifier(importName);

      return remixPackagesFull.includes(packageName) &&
        importName !== "@remix-run/deno"
        ? [
            importName,
            `https://esm.sh/${packageName}@${nextVersion}${
              importPath ? `/${importPath}` : ""
            }`,
          ]
        : [importName, path];
    })
  );

  return jsonfile.writeFile(
    importMapPath,
    { ...json, imports: newImports },
    { spaces: 2 }
  );
};

/**
 * @param {string} nextVersion
 */
async function incrementRemixVersion(nextVersion) {
  let isOneOffRelease =
    nextVersion.includes("experimental") || nextVersion.includes("nightly");
  let isPrerelease = nextVersion.includes("pre");
  let isStable = !isOneOffRelease && !isPrerelease;

  // Update version numbers in package.json for all packages
  await updateRemixVersion("remix", nextVersion);
  await updateRemixVersion("create-remix", nextVersion);
  for (let name of remixPackages.all) {
    await updateRemixVersion(`remix-${name}`, nextVersion);
  }

  if (isStable) {
    // Update version numbers in Deno's import maps
    await Promise.all(
      [
        path.join(".vscode", "deno_resolve_npm_imports.json"),
        path.join(
          "templates",
          "classic-remix-compiler",
          "deno",
          ".vscode",
          "resolve_npm_imports.json"
        ),
      ].map((importMapPath) =>
        updateDenoImportMap(path.join(rootDir, importMapPath), nextVersion)
      )
    );
  }

  // Commit and tag
  execSync(`git commit --all --message="Version ${nextVersion}"`);
  let tag = isOneOffRelease ? `v${nextVersion}` : `remix@${nextVersion}`;
  execSync(`git tag -a -m "Version ${nextVersion}" ${tag}`);
  console.log(chalk.green(`  Committed and tagged version ${nextVersion}`));
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fsp.stat(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

exports.rootDir = rootDir;
exports.remixPackages = remixPackages;
exports.fileExists = fileExists;
exports.packageJson = packageJson;
exports.getPackageVersion = getPackageVersion;
exports.ensureCleanWorkingDirectory = ensureCleanWorkingDirectory;
exports.prompt = prompt;
exports.updatePackageConfig = updatePackageConfig;
exports.updateRemixVersion = updateRemixVersion;
exports.incrementRemixVersion = incrementRemixVersion;
