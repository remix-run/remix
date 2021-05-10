const fsp = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");

const chalk = require("chalk");
const Confirm = require("prompt-confirm");
const jsonfile = require("jsonfile");
const semver = require("semver");

const packagesDir = path.resolve(__dirname, "../packages");

function packageJson(packageName) {
  return path.join(packagesDir, packageName, "package.json");
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
  let file = packageJson(packageName);
  let json = await jsonfile.readFile(file);
  return json.version;
}

async function updatePackageConfig(packageName, transform) {
  let file = packageJson(packageName);
  let json = await jsonfile.readFile(file);
  transform(json);
  await jsonfile.writeFile(file, json, { spaces: 2 });
}

function isPrereleaseVersion(version) {
  return semver.prerelease(version) != null;
}

async function updateChangesVersion(version, date) {
  let file = path.resolve(__dirname, "../CHANGES.md");
  let contents = await fsp.readFile(file, "utf-8");
  let updated = contents.replace(
    /## Unreleased/,
    `## ${version} - ${date.toDateString()}`
  );
  await fsp.writeFile(file, updated);
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

  // Update remix-dev, remix-init, remix-node, and remix-react versions
  for (let name of ["dev", "init", "node", "react"]) {
    await updatePackageConfig(`remix-${name}`, config => {
      config.version = nextVersion;
    });
    console.log(
      chalk.green(`  Updated @remix-run/${name} to version ${nextVersion}`)
    );
  }

  // Update remix-* node server versions + remix-node dep
  for (let name of ["architect", "express", "vercel"]) {
    await updatePackageConfig(`remix-${name}`, config => {
      config.version = nextVersion;
      config.dependencies["@remix-run/node"] = nextVersion;
    });
    console.log(
      chalk.green(`  Updated @remix-run/${name} to version ${nextVersion}`)
    );
  }

  // Update remix-serve version + remix-express dep
  await updatePackageConfig("remix-serve", config => {
    config.version = nextVersion;
    config.dependencies["@remix-run/express"] = nextVersion;
  });
  console.log(
    chalk.green(`  Updated @remix-run/serve to version ${nextVersion}`)
  );

  if (!isPrereleaseVersion(nextVersion)) {
    // Update CHANGES.md release date
    await updateChangesVersion(nextVersion, new Date());
    console.log(
      chalk.green(`  Updated release version and date in CHANGES.md`)
    );
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
