const semver = require("semver");

const {
  ensureCleanWorkingDirectory,
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

  ensureCleanWorkingDirectory();

  // Get the next version number
  let nextVersion = semver.valid(givenVersion);
  if (nextVersion == null) {
    throw new Error("Invalid version: " + givenVersion);
  }

  await incrementRemixVersion(nextVersion);
}
