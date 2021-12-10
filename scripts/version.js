const fsp = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");
const Confirm = require("prompt-confirm");
const jsonfile = require("jsonfile");
const semver = require("semver");

let rootDir = path.resolve(__dirname, "..");
let examplesDir = path.resolve(rootDir, "examples");

let adapters = ["architect", "express", "netlify", "vercel"];
let runtimes = ["cloudflare-workers", "node"];
let core = ["dev", "server-runtime", "react", "eslint-config"];
let allPackages = [...adapters, ...runtimes, ...core, "serve"];

/**
 * @param {string} packageName
 * @param {string} [directory]
 * @returns {string}
 */
function packageJson(packageName, directory) {
  return path.join(rootDir, directory, packageName, "package.json");
}

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
    nextVersion = semver.inc(currentVersion, givenVersion, prereleaseId);
  }

  if (nextVersion == null) {
    console.error(`Invalid version specifier: ${givenVersion}`);
    process.exit(1);
  }

  return nextVersion;
}

async function prompt(question) {
  let confirm = new Confirm(question);
  let answer = await confirm.run();
  return answer;
}

async function getPackageVersion(packageName) {
  let file = packageJson(packageName, "packages");
  let json = await jsonfile.readFile(file);
  return json.version;
}

async function updatePackageConfig(packageName, transform) {
  let file = packageJson(packageName, "packages");
  let json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

/**
 * @param {string} example
 * @param {(json: string) => any} transform
 */
async function updateExamplesPackageConfig(example, transform) {
  let file = packageJson(example, "examples");
  if (!(await fileExists(file))) return;

  let json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

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

  // Update core package versions
  for (let name of core) {
    await updatePackageConfig(`remix-${name}`, config => {
      config.version = nextVersion;
    });
    console.log(
      chalk.green(`  Updated @remix-run/${name} to version ${nextVersion}`)
    );
  }

  // Update remix-cloudflare-workers and remix-node versions + server-runtime dep
  for (let name of runtimes) {
    await updatePackageConfig(`remix-${name}`, config => {
      config.version = nextVersion;
      config.dependencies["@remix-run/server-runtime"] = nextVersion;
    });
    console.log(
      chalk.green(`  Updated @remix-run/${name} to version ${nextVersion}`)
    );
  }

  // Update remix-* node server versions + remix-node dep
  for (let name of adapters) {
    await updatePackageConfig(`remix-${name}`, config => {
      config.version = nextVersion;
      config.dependencies["@remix-run/node"] = nextVersion;
    });
    console.log(
      chalk.green(`  Updated @remix-run/${name} to version ${nextVersion}`)
    );
  }

  // Update create-remix version
  await updatePackageConfig("create-remix", config => {
    config.version = nextVersion;
  });
  console.log(chalk.green(`  Updated create-remix to version ${nextVersion}`));

  // Update remix-serve version + remix-express dep
  await updatePackageConfig("remix-serve", config => {
    config.version = nextVersion;
    config.dependencies["@remix-run/express"] = nextVersion;
  });
  console.log(
    chalk.green(`  Updated @remix-run/serve to version ${nextVersion}`)
  );

  // Update remix versions in the examples
  let examples = await fsp.readdir(examplesDir);
  if (examples.length > 0) {
    for (let example of examples) {
      let stat = await fsp.stat(path.join(examplesDir, example));
      if (!stat.isDirectory()) continue;

      await updateExamplesPackageConfig(example, config => {
        if (config.dependencies["remix"]) {
          config.dependencies["remix"] = nextVersion;
        }

        for (let pkg of allPackages) {
          if (config.dependencies[`@remix-run/${pkg}`]) {
            config.dependencies[`@remix-run/${pkg}`] = nextVersion;
          }
          if (config.devDependencies[`@remix-run/${pkg}`]) {
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
    let stat = await fsp.stat(filePath);
    return stat.code !== "ENOENT";
  } catch (_) {
    return false;
  }
}
