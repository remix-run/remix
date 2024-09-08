const { execSync } = require("node:child_process");
const semver = require("semver");

const {
  ensureCleanWorkingDirectory,
  getPackageVersion,
  prompt,
  incrementRemixVersion,
} = require("./utils");

run(process.argv.slice(2)).then(
  () => {
    process.exit(0);
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);

/**
 * @param {string[]} args
 */
async function run(args) {
  let givenVersion = args[0];
  let prereleaseId = args[1];

  ensureCleanWorkingDirectory();

  // Get the remix version number
  let currentVersion = await getPackageVersion("remix");
  let remixVersion = semver.valid(givenVersion);
  if (remixVersion == null) {
    remixVersion = getRemixVersion(currentVersion, givenVersion, prereleaseId);
  }

  // Confirm the remix version number
  if (prereleaseId !== "--skip-prompt") {
    let answer = await prompt(
      `Are you sure you want to bump version ${currentVersion} to ${remixVersion}? [Yn] `
    );
    if (answer === false) return 0;
  }

  await incrementRemixVersion(remixVersion);
}

/**
 * @param {string|undefined} currentVersion
 * @param {string} givenVersion
 * @param {string} [prereleaseId]
 * @returns
 */
function getRemixVersion(currentVersion, givenVersion, prereleaseId = "pre") {
  if (givenVersion == null) {
    console.error("Missing remix version. Usage: node version.js [remixVersion]");
    process.exit(1);
  }

  let remixVersion = semver.inc(currentVersion, givenVersion, prereleaseId);
  if (remixVersion == null) {
    console.error(`Invalid version specifier: ${givenVersion}`);
    process.exit(1);
  }

  return remixVersion;
}
