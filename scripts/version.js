const fsp = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");
const jsonfile = require("jsonfile");
const semver = require("semver");

const {
  ensureCleanWorkingDirectory,
  getPackageVersion,
  packageJson,
  prompt,
  rootDir
} = require("./utils");

let examplesDir = path.resolve(rootDir, "examples");

let adapters = ["architect", "express", "netlify", "vercel"];
let runtimes = ["cloudflare-workers", "cloudflare-pages", "deno", "node"];
let core = ["dev", "server-runtime", "react", "eslint-config"];
let allPackages = [...adapters, ...runtimes, ...core, "serve"];

/**
 * @param {string} currentVersion
 * @param {string} givenVersion
 * @param {string} [prereleaseId]
 * @returns
 */
function getNextVersion(currentVersion, givenVersion, prereleaseId = "pre") {
  if (givenVersion == null) {
    console.error("Missing next version. Usage: node version.js [nextVersion]");
    process.exit(1);
  }

  let nextVersion;
  if (givenVersion === "experimental") {
    let hash = execSync(`git rev-parse --short HEAD`).toString().trim();
    nextVersion = `0.0.0-experimental-${hash}`;
  } else {
    // @ts-ignore
    nextVersion = semver.inc(currentVersion, givenVersion, prereleaseId);
  }

  if (nextVersion == null) {
    console.error(`Invalid version specifier: ${givenVersion}`);
    process.exit(1);
  }

  return nextVersion;
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
 * @param {string[]} args
 */
async function run(args) {
  let givenVersion = args[0];
  let prereleaseId = args[1];

  ensureCleanWorkingDirectory();

  // Get the next version number
  let currentVersion = await getPackageVersion("remix");
  let nextVersion = semver.valid(givenVersion);
  if (nextVersion == null) {
    nextVersion = getNextVersion(currentVersion, givenVersion, prereleaseId);
  }

  // Confirm the next version number
  let answer = await prompt(
    `Are you sure you want to bump version ${currentVersion} to ${nextVersion}? [Yn] `
  );
  if (answer === false) return 0;

  // Update remix version
  await updatePackageConfig("remix", config => {
    config.version = nextVersion;
  });
  console.log(chalk.green(`  Updated remix to version ${nextVersion}`));

  // Update create-remix version
  await updatePackageConfig("create-remix", config => {
    config.version = nextVersion;
  });
  console.log(chalk.green(`  Updated create-remix to version ${nextVersion}`));

  for (let name of allPackages) {
    await updatePackageConfig(`remix-${name}`, config => {
      config.version = nextVersion;
      for (let pkg of allPackages) {
        if (config.dependencies?.[`@remix-run/${pkg}`]) {
          config.dependencies[`@remix-run/${pkg}`] = nextVersion;
        }
        if (config.devDependencies?.[`@remix-run/${pkg}`]) {
          config.devDependencies[`@remix-run/${pkg}`] = nextVersion;
        }
      }
    });
    console.log(
      chalk.green(`  Updated @remix-run/${name} to version ${nextVersion}`)
    );
  }

  // Update remix versions in the examples
  let examples = await fsp.readdir(examplesDir);
  if (examples.length > 0) {
    for (let example of examples) {
      let stat = await fsp.stat(path.join(examplesDir, example));
      if (!stat.isDirectory()) continue;

      await updateExamplesPackageConfig(example, config => {
        if (config.dependencies?.["remix"]) {
          config.dependencies["remix"] = nextVersion;
        }

        for (let pkg of allPackages) {
          if (config.dependencies?.[`@remix-run/${pkg}`]) {
            config.dependencies[`@remix-run/${pkg}`] = nextVersion;
          }
          if (config.devDependencies?.[`@remix-run/${pkg}`]) {
            config.devDependencies[`@remix-run/${pkg}`] = nextVersion;
          }
        }
      });

      console.log(
        chalk.green(`  Updated remix versions in ${example} example`)
      );
    }
  }

  // Commit and tag
  execSync(`git commit --all --message="Version ${nextVersion}"`);
  execSync(`git tag -a -m "Version ${nextVersion}" v${nextVersion}`);

  console.log(chalk.green(`  Committed and tagged version ${nextVersion}`));
}

run(process.argv.slice(2)).then(
  () => {
    process.exit(0);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);

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
