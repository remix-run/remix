const fsp = require("fs").promises;
const path = require("path");
const { execSync } = require("child_process");

const chalk = require("chalk");
const Confirm = require("prompt-confirm");
const jsonfile = require("jsonfile");
const semver = require("semver");

const packagesDir = path.resolve(__dirname, "../packages");

function invariant(cond, message) {
  if (!cond) throw new Error(message);
}

function packageJson(packageName) {
  return path.join(packagesDir, packageName, "package.json");
}

function ensureCleanWorkingDirectory() {
  let status = execSync(`git status --porcelain`).toString().trim();
  let lines = status.split("\n");
  invariant(
    lines.every(line => line === "" || line.startsWith("?")),
    "Working directory is not clean. Please commit or stash your changes."
  );
}

function getNextVersion(currentVersion, givenVersion, prereleaseId = "pre") {
  invariant(
    givenVersion != null,
    `Missing next version. Usage: node version.js [nextVersion]`
  );

  let nextVersion;
  if (givenVersion === "experimental") {
    let hash = execSync(`git rev-parse --short HEAD`).toString().trim();
    nextVersion = `0.0.0-experimental-${hash}`;
  } else {
    nextVersion = semver.inc(currentVersion, givenVersion, prereleaseId);
  }

  invariant(nextVersion != null, `Invalid version specifier: ${givenVersion}`);

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

  // - Get the next version number
  let currentVersion = await getPackageVersion("react");
  let nextVersion = semver.valid(givenVersion);
  if (nextVersion == null) {
    nextVersion = getNextVersion(currentVersion, givenVersion, prereleaseId);
  }

  // - Confirm the next version number
  let answer = await prompt(
    `Are you sure you want to bump version ${currentVersion} to ${nextVersion}? [Yn] `
  );
  if (answer === false) return 0;

  // - Update @remix-run/core version
  await updatePackageConfig("core", config => {
    config.version = nextVersion;
  });
  console.log(
    chalk.green(`  Updated @remix-run/core to version ${nextVersion}`)
  );

  // - Update @remix-run/dev version
  await updatePackageConfig("dev", config => {
    config.version = nextVersion;
  });
  console.log(
    chalk.green(`  Updated @remix-run/dev to version ${nextVersion}`)
  );

  // - Update @remix-run/data version + @remix-run/core dep
  await updatePackageConfig("data", config => {
    config.version = nextVersion;
    config.dependencies["@remix-run/core"] = nextVersion;
  });
  console.log(
    chalk.green(`  Updated @remix-run/data to version ${nextVersion}`)
  );

  // - Update @remix-run/react version
  await updatePackageConfig("react", config => {
    config.version = nextVersion;
  });
  console.log(
    chalk.green(`  Updated @remix-run/react to version ${nextVersion}`)
  );

  // - Update platform versions + @remix-run/core dep
  for (let platform of ["architect", "express", "vercel"]) {
    await updatePackageConfig(platform, config => {
      config.version = nextVersion;
      config.dependencies["@remix-run/core"] = nextVersion;
    });
    console.log(
      chalk.green(`  Updated @remix-run/${platform} to version ${nextVersion}`)
    );
  }

  if (!isPrereleaseVersion(nextVersion)) {
    // - Update CHANGES.md release date
    await updateChangesVersion(nextVersion, new Date());
    console.log(
      chalk.green(`  Updated release version and date in CHANGES.md`)
    );
  }

  // - Commit and tag
  execSync(`git commit --all --message="Version ${nextVersion}"`);
  execSync(`git tag -a -m "Version ${nextVersion}" v${nextVersion}`);

  console.log(chalk.green(`  Committed and tagged version ${nextVersion}`));

  return 0;
}

run(process.argv.slice(2)).then(
  code => {
    process.exit(code);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);
