const fsp = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");
const Confirm = require("prompt-confirm");
const jsonfile = require("jsonfile");
const semver = require("semver");

const rootDir = path.resolve(__dirname, "..");
const examplesDir = path.resolve(rootDir, "examples");

const adapters = ["architect", "express", "netlify", "vercel"];
const runtimes = ["cloudflare-workers", "cloudflare-pages", "node"];
const core = ["dev", "server-runtime", "react", "eslint-config"];
const allPackages = [...adapters, ...runtimes, ...core, "serve"];

/**
 * @param {string} packageName
 * @param {string} [directory]
 * @returns {string}
 */
function packageJson(packageName, directory) {
  return path.join(rootDir, directory, packageName, "package.json");
}

function ensureCleanWorkingDirectory() {
  const status = execSync(`git status --porcelain`).toString().trim();
  const lines = status.split("\n");
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
    const hash = execSync(`git rev-parse --short HEAD`).toString().trim();
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
  const confirm = new Confirm(question);
  const answer = await confirm.run();
  return answer;
}

async function getPackageVersion(packageName) {
  const file = packageJson(packageName, "packages");
  const json = await jsonfile.readFile(file);
  return json.version;
}

async function updatePackageConfig(packageName, transform) {
  const file = packageJson(packageName, "packages");
  const json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

/**
 * @param {string} example
 * @param {(json: string) => any} transform
 */
async function updateExamplesPackageConfig(example, transform) {
  const file = packageJson(example, "examples");
  if (!(await fileExists(file))) return;

  const json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

async function run(args) {
  const givenVersion = args[0];
  const prereleaseId = args[1];

  ensureCleanWorkingDirectory();

  // Get the next version number
  const currentVersion = await getPackageVersion("remix");
  let nextVersion = semver.valid(givenVersion);
  if (nextVersion == null) {
    nextVersion = getNextVersion(currentVersion, givenVersion, prereleaseId);
  }

  // Confirm the next version number
  const answer = await prompt(
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

  for (const name of allPackages) {
    await updatePackageConfig(`remix-${name}`, config => {
      config.version = nextVersion;
      for (const pkg of allPackages) {
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
  const examples = await fsp.readdir(examplesDir);
  if (examples.length > 0) {
    for (const example of examples) {
      const stat = await fsp.stat(path.join(examplesDir, example));
      if (!stat.isDirectory()) continue;

      await updateExamplesPackageConfig(example, config => {
        if (config.dependencies["remix"]) {
          config.dependencies["remix"] = nextVersion;
        }

        for (const pkg of allPackages) {
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
    const stat = await fsp.stat(filePath);
    return stat.code !== "ENOENT";
  } catch (_) {
    return false;
  }
}
