const fsp = require("fs").promises;
const chalk = require("chalk");
const path = require("path");
const { execSync } = require("child_process");
const jsonfile = require("jsonfile");
const Confirm = require("prompt-confirm");

let rootDir = path.resolve(__dirname, "..");
let examplesDir = path.resolve(rootDir, "examples");

let remixPackages = {
  adapters: ["architect", "express", "netlify", "vercel"],
  runtimes: ["cloudflare-workers", "cloudflare-pages", "deno", "node"],
  core: ["dev", "server-runtime", "react", "eslint-config"],
  get all() {
    return [...this.adapters, ...this.runtimes, ...this.core, "serve"];
  }
};

/**
 * @param {string} packageName
 * @param {string} [directory]
 * @returns {string}
 */
function packageJson(packageName, directory) {
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
  if (!lines.every(line => line === "" || line.startsWith("?"))) {
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
  let json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

/**
 * @param {string} example
 * @param {(json: import('type-fest').PackageJson) => any} transform
 */
async function updateExamplesPackageConfig(example, transform) {
  let file = packageJson(example, "examples");
  if (!(await fileExists(file))) return;

  let json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

/**
 * @param {string} nextVersion
 */
async function updateExamplesRemixVersion(nextVersion) {
  let examples = await fsp.readdir(examplesDir);
  if (examples.length > 0) {
    for (let example of examples) {
      let stat = await fsp.stat(path.join(examplesDir, example));
      if (!stat.isDirectory()) continue;

      await updateExamplesPackageConfig(example, config => {
        if (config.dependencies?.["remix"]) {
          config.dependencies["remix"] = nextVersion;
        }

        for (let pkg of remixPackages.all) {
          if (config.dependencies?.[`@remix-run/${pkg}`]) {
            config.dependencies[`@remix-run/${pkg}`] = nextVersion;
          }
          if (config.devDependencies?.[`@remix-run/${pkg}`]) {
            config.devDependencies[`@remix-run/${pkg}`] = nextVersion;
          }
        }

        console.log(
          chalk.green(
            `  Updated Remix to version ${chalk.bold(
              nextVersion
            )} in ${chalk.bold(example)} example`
          )
        );
      });
    }
  }
}

/**
 * @param {string} packageName
 * @param {string} nextVersion
 * @param {string} [successMessage]
 */
async function updateRemixVersion(packageName, nextVersion, successMessage) {
  await updatePackageConfig(packageName, config => {
    config.version = nextVersion;
    for (let pkg of remixPackages.all) {
      if (config.dependencies?.[`@remix-run/${pkg}`]) {
        config.dependencies[`@remix-run/${pkg}`] = nextVersion;
      }
      if (config.devDependencies?.[`@remix-run/${pkg}`]) {
        config.devDependencies[`@remix-run/${pkg}`] = nextVersion;
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
 * @param {string} nextVersion
 */
async function incrementRemixVersion(nextVersion) {
  // Update version numbers in package.json for all packages
  await updateRemixVersion("remix", nextVersion);
  await updateRemixVersion("create-remix", nextVersion);
  for (let name of remixPackages.all) {
    await updateRemixVersion(`remix-${name}`, nextVersion);
  }

  // Update versions in the examples
  await updateExamplesRemixVersion(nextVersion);

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
exports.examplesDir = examplesDir;
exports.remixPackages = remixPackages;
exports.fileExists = fileExists;
exports.packageJson = packageJson;
exports.getPackageVersion = getPackageVersion;
exports.ensureCleanWorkingDirectory = ensureCleanWorkingDirectory;
exports.prompt = prompt;
exports.updatePackageConfig = updatePackageConfig;
exports.updateRemixVersion = updateRemixVersion;
exports.incrementRemixVersion = incrementRemixVersion;
