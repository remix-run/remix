const { execSync } = require("child_process");
const chalk = require("chalk");
const semver = require("semver");

const {
  ensureCleanWorkingDirectory,
  getPackageVersion,
  prompt
} = require("./utils");

run(process.argv.slice(2)).then(
  () => {
    process.exit(0);
  },
  error => {
    console.error(chalk.red(error));
    process.exit(1);
  }
);

async function run(args) {
  let givenVersion = args[0];
  let prereleaseId = args[1];

  ensureCleanWorkingDirectory();

  // 1. Get the next version number
  let currentVersion = await getPackageVersion("remix");
  let nextVersion = semver.valid(givenVersion);
  if (nextVersion == null) {
    nextVersion = getNextVersion(currentVersion, givenVersion, prereleaseId);
  }
  let versionTag = "v" + nextVersion;
  let releaseBranch = `release/${versionTag}`;

  let initialBranch = getCurrentBranch();

  // 2. Confirm the next version number
  let answer = await prompt(
    `Are you sure you want to release version ${chalk.bold(nextVersion)}? [Yn] `
  );
  if (answer === false) return 0;

  // 3. Ensure that non-experimental releases are created from the dev branch
  if (!isExperimentalRelease(nextVersion)) {
    if (initialBranch !== "dev") {
      throw Error("Releases should be created from the dev branch.");
    }

    // 3a. Pull from the origin/dev and rebase commits as needed
    try {
      let resp = execSync(`git pull --rebase origin dev`).toString();
      if (hasMergeConflicts(resp)) {
        let answer = await prompt(
          `Merge conflicts detected. Resolve all conflicts and commit the changes before resuming the process.
        ${chalk.bold("Press Y to continue or N to cancel the release.")}`
        );
        if (answer === false) return 0;
      } else if (mergeFailed(resp)) {
        console.error(chalk.red("Merge failed.\n"));
        throw Error(resp);
      }
    } catch (e) {
      console.error(chalk.red("Error rebasing to origin/dev"));
      throw e;
    }
  }

  // 4. Checkout new release branch
  try {
    checkoutNewBranch(releaseBranch);
  } catch (e) {
    throw Error(
      `Branch ${chalk.bold(
        releaseBranch
      )} already exists. Delete the branch if you wish to create a new release from the same version, or use a different version number.`
    );
  }

  // 5. Merge updates from the main branch for stable releases
  if (!isPreRelease(nextVersion)) {
    execSync(`git checkout main`);
    try {
      let resp = execSync(`git pull --rebase origin main`).toString();
      if (hasMergeConflicts(resp)) {
        let answer = await prompt(
          `Merge conflicts detected. Resolve all conflicts and commit the changes before resuming the process.
    ${chalk.bold("Press Y to continue or N to cancel the release.")}`
        );
        if (answer === false) return 0;
      } else if (mergeFailed(resp)) {
        console.error(chalk.red("Merge failed.\n"));
        throw Error(resp);
      }
    } catch (e) {
      console.error(chalk.red("Rebasing error when pulling from origin/main"));
      throw e;
    }

    // 5a. Return to the release branch and merge changes from main
    execSync(`git checkout ${releaseBranch}`);
    let resp = execSync(`git merge main`).toString();
    if (hasMergeConflicts(resp)) {
      let answer = await prompt(
        `Merge conflicts detected. Resolve all conflicts and commit the changes before resuming the process.
        ${chalk.bold("Press Y to continue or N to cancel the release.")}`
      );
      if (answer === false) return 0;
    } else if (mergeFailed(resp)) {
      console.error(chalk.red("Merge failed.\n"));
      throw Error(resp);
    }
  }

  // 6. Run the version script to update all package versions and create tag
  execSync(`yarn run version ${nextVersion} ${prereleaseId ?? ""}`);

  // 7. Push the release branch and tags to GitHub. All releases will be
  //    triggered from there.
  execSync(`git push origin ${releaseBranch} --follow-tags`);

  console.log(
    chalk.green(
      `Remix version ${nextVersion} is now ready to release. To trigger the release process, create a new release in GitHub from the ${versionTag} tag:

  - Navigate to https://github.com/remix-run/remix/releases/new
  - Select ${chalk.bold(versionTag)} from the "Choose a tag" menu
  - Draft the release notes
  - If this is a pre-release, be sure to select the ${chalk.bold(
    "This is a pre-release"
  )} checkbox
  - Click ${chalk.bold("Publish release")}

Once the CI is complete, the new release will be published to npm. 🥳`
    )
  );

  // 8. Optionally, merge new release branch back into dev. This should usually
  //    be done but may be skipped in some cases (hotfixes, etc.)
  let mergeToDev = await prompt(
    `Do you want to merge ${releaseBranch} into ${chalk.bold("dev")}? [Yn]`
  );
  if (mergeToDev) {
    execSync(`git checkout dev`);
    execSync(`git merge ${releaseBranch}`);

    // For simplicity, do not push back to origin/dev automatically. If the
    // remote dev branch has changed since we started the release process we
    // should handle this manually.
    console.log(
      `Successfully merged ${releaseBranch} into dev. Be sure to push changes to origin/dev`
    );
  }

  // 9. Optionally, merge new release branch back into main. Only offered for
  //    stable releases, as main should reflect the latest stable version.
  if (!isPreRelease(nextVersion)) {
    let mergeToMain = await prompt(
      `Do you want to merge ${releaseBranch} into ${chalk.bold("main")}? [Yn]`
    );
    if (mergeToMain) {
      execSync(`git checkout main`);
      execSync(`git merge ${releaseBranch}`);

      // For simplicity, do not push back to origin/main automatically. If the
      // remote main branch has changed since we started the release process we
      // should handle this manually.
      console.log(
        `Successfully merged ${releaseBranch} into main. Be sure to push changes to origin/main`
      );
    }
  }

  // 10. Return to the initial branch before exit
  execSync(`git checkout ${initialBranch}`);
}

function getNextVersion(currentVersion, givenVersion, prereleaseId = "pre") {
  if (givenVersion == null) {
    throw Error("Missing next version. Usage: node release.js [nextVersion]");
  }

  let nextVersion;
  if (givenVersion === "experimental") {
    let hash = execSync(`git rev-parse --short HEAD`).toString().trim();
    nextVersion = `0.0.0-experimental-${hash}`;
  } else {
    nextVersion = semver.inc(currentVersion, givenVersion, prereleaseId);
  }

  if (nextVersion == null) {
    throw Error(`Invalid version specifier: ${givenVersion}`);
  }

  return nextVersion;
}

function getCurrentBranch() {
  let output = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
  return output;
}

/**
 * @param {string} version
 * @returns {boolean}
 */
function isExperimentalRelease(version) {
  return version.includes("experimental");
}

/**
 * @param {string} version
 * @returns {boolean}
 */
function isPreRelease(version) {
  return (
    isExperimentalRelease(version) ||
    version.includes("alpha") ||
    version.includes("beta")
  );
}

/**
 * @param {string} output
 * @returns {boolean}
 */
function hasMergeConflicts(output) {
  let lines = output.trim().split("\n");
  return lines.some(line => /^CONFLICT\s/.test(line));
}

/**
 * @param {string} output
 * @returns {boolean}
 */
function mergeFailed(output) {
  let lines = output.trim().split("\n");
  return lines.some(line => /^Automatic merge failed;\s/.test(line));
}

/**
 * @param {string} branch
 */
function checkoutNewBranch(branch) {
  let output = execSync(`git checkout -b ${branch}`).toString().trim();
  if (/^fatal:/.test(output)) {
    throw Error(`Branch ${chalk.bold(output)} already exists.`);
  }
}
