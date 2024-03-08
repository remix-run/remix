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
    for (let pkg of remixPackages.all) {
      if (config.dependencies?.[`@remix-run/${pkg}`]) {
        config.dependencies[`@remix-run/${pkg}`] = nextVersion;
      }
      if (config.devDependencies?.[`@remix-run/${pkg}`]) {
        config.devDependencies[`@remix-run/${pkg}`] = nextVersion;
      }
      if (config.peerDependencies?.[`@remix-run/${pkg}`]) {
        let isRelaxedPeerDep =
          config.peerDependencies[`@remix-run/${pkg}`]?.startsWith("^");
        config.peerDependencies[`@remix-run/${pkg}`] = `${
          isRelaxedPeerDep ? "^" : ""
        }${nextVersion}`;
      }
    }
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
 *
 * @param {string} nextVersion
 */
async function updateDeploymentScriptVersion(nextVersion) {
  let file = packageJson("deployment-test", "scripts");
  let json = await jsonfile.readFile(file);
  json.dependencies["@remix-run/dev"] = nextVersion;
  await jsonfile.writeFile(file, json, { spaces: 2 });

  console.log(
    chalk.green(
      `  Updated Remix to version ${chalk.bold(nextVersion)} in ${chalk.bold(
        "scripts/deployment-test"
      )}`
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
async function incrementRemixVersion(nextVersion, syncLockFile = false) {
  // Update version numbers in package.json for all packages
  await updateRemixVersion("remix", nextVersion);
  await updateRemixVersion("create-remix", nextVersion);
  for (let name of remixPackages.all) {
    await updateRemixVersion(`remix-${name}`, nextVersion);
  }

  // Sync up the pnpm-lock.yaml file with the new experimental version
  if (syncLockFile) {
    console.log(chalk.green("  Syncing pnpm lockfile..."));
    execSync("pnpm install --no-frozen-lockfile");
  }

  // Update version numbers in Deno's import maps
  await Promise.all(
    [
      path.join(".vscode", "deno_resolve_npm_imports.json"),
      path.join("templates", "deno", ".vscode", "resolve_npm_imports.json"),
    ].map((importMapPath) =>
      updateDenoImportMap(path.join(rootDir, importMapPath), nextVersion)
    )
  );

  // Update deployment script `@remix-run/dev` version
  await updateDeploymentScriptVersion(nextVersion);

  // Commit and tag
  execSync(`git commit --all --message="Version ${nextVersion}"`);
  execSync(`git tag -a -m "Version ${nextVersion}" v${nextVersion}`);
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
