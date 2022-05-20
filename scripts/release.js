const { execSync } = require("child_process");
const chalk = require("chalk");

const {
  ensureCleanWorkingDirectory,
  prompt,
  incrementRemixVersion,
} = require("./utils");

run().then(
  () => {
    process.exit(0);
  },
  (error) => {
    console.error(chalk.red(error));
    process.exit(1);
  }
);

async function run() {
  ensureCleanWorkingDirectory();
  let hash = execSync(`git rev-parse --short HEAD`).toString().trim();
  let nextVersion = `0.0.0-experimental-${hash}`;
  let answer = await prompt(
    `Are you sure you want to bump to version ${nextVersion}? [Yn] `
  );
  if (answer === false) {
    return 0;
  }
  await incrementRemixVersion(nextVersion);

  // push the tag, not the branch
  execSync(`git push origin v${nextVersion}`);
  console.log(chalk.green(`  Pushed v${nextVersion} tag to GitHub`));

  // Revert version commit, these shouldn't be pushed or merged into dev
  execSync(`git reset HEAD~1 --hard`);

  console.log(
    chalk.green(`  ---------------------------------------------------------------------------------------
  The new version is ready to release. To trigger the publish script, create a new
  release in GtiHub from the v${nextVersion} tag.

  https://github.com/remix-run/remix/releases/new?tag=v${nextVersion}
  ---------------------------------------------------------------------------------------`)
  );
}
