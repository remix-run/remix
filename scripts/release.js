const { execSync } = require("node:child_process");
const chalk = require("chalk");
const path = require("node:path");
const semver = require("semver");
const { default: simpleGit } = require("simple-git");
const git = simpleGit(path.resolve(__dirname, ".."));

const {
  ensureCleanWorkingDirectory,
  getPackageVersion,
  prompt,
  incrementRemixVersion,
} = require("./utils");

const releaseTypes = ["patch", "minor", "major"];

run(process.argv.slice(2)).then(
  () => {
    process.exit(0);
  },
  (error) => {
    console.error(chalk.red(error));
    process.exit(1);
  }
);

/**
 * @param {string[]} args
 */
async function run(args) {
  ensureCleanWorkingDirectory();

  /** @type {string | undefined} */
  let phase;
  /** @type {string | undefined} */
  let givenVersion;
  /** @type {string | undefined} */
  let remixVersion;

  // Validate args and get the remix version number
  if (
    args.length === 1 &&
    (releaseTypes.includes(args[0]) || semver.valid(args[0]))
  ) {
    phase = "start";
    givenVersion = args[0];
  } else {
    phase = args[0];
    givenVersion = args[1];
  }

  let allTags = getAllTags();
  let currentBranch = getCurrentBranch();
  let gitArgs = { tags: allTags, initialBranch: currentBranch };

  switch (phase) {
    case "start": {
      remixVersion = await initStart(givenVersion, gitArgs);
      break;
    }
    case "bump": {
      remixVersion = await initBump(gitArgs);
      break;
    }
    case "finish": {
      remixVersion = await initFinish(gitArgs);
      break;
    }
    default:
      throw Error(`Invalid argument. Usage:

  $ pnpm release [start | bump | finish] [patch | minor | major]`);
  }

  if (versionExists(allTags, remixVersion)) {
    throw Error(`Version ${remixVersion} has already been released.`);
  }

  let answer = await prompt(
    `Are you sure you want to release version ${chalk.bold(remixVersion)}? [Yn] `
  );
  if (answer === false) return 0;

  switch (phase) {
    case "start": {
      await execStart(remixVersion);
      break;
    }
    case "bump": {
      await execBump(remixVersion, gitArgs);
      break;
    }
    case "finish": {
      await execFinish(remixVersion, gitArgs);
      break;
    }
  }

  let versionTag = getVersionTag(remixVersion);

  console.log(
    chalk.green(
      `Remix version ${remixVersion} is now ready to release. To trigger the release process, create a new release in GitHub from the ${versionTag} tag:
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
}

/**
 * @param {string} givenVersion
 * @param {GitAttributes} git
 * @returns {Promise<string>}
 */
async function initStart(givenVersion, git) {
  ensureDevBranch(git.initialBranch);

  if (releaseTypes.includes(givenVersion)) {
    givenVersion = `pre${givenVersion}`;
  }

  /** @type {string | null} */
  let remixVersion = semver.valid(givenVersion);
  if (remixVersion == null) {
    remixVersion = getRemixVersion(
      await getPackageVersion("remix"),
      givenVersion
    );
  }

  return remixVersion;
}

/**
 * @param {GitAttributes} git
 * @returns {Promise<string>}
 */
async function initBump(git) {
  ensureLatestReleaseBranch(git.initialBranch, git);
  let versionFromBranch = getVersionFromReleaseBranch(git.initialBranch);
  let currentVersion = git.tags
    .filter((tag) => tag.startsWith("v" + versionFromBranch))
    .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))[0];
  let remixVersion = semver.inc(currentVersion, "prerelease");
  if (!remixVersion) {
    throw Error(`Invalid semver version: ${currentVersion}`);
  }
  return remixVersion;
}

/**
 * @param {GitAttributes} git
 * @returns {Promise<string>}
 */
async function initFinish(git) {
  ensureLatestReleaseBranch(git.initialBranch, git);
  let remixVersion = getVersionFromReleaseBranch(git.initialBranch);
  return remixVersion;
}

/**
 * @param {string} remixVersion
 */
async function execStart(remixVersion) {
  let releaseBranch = getReleaseBranch(remixVersion);

  await gitPull("dev");
  try {
    checkoutNewBranch(releaseBranch);
  } catch {
    throw Error(
      `Branch ${chalk.bold(
        releaseBranch
      )} already exists. Delete the branch if you wish to create a new release from the same version, or use a different version number.`
    );
  }

  await gitMerge("main", releaseBranch, { pullFirst: true });
  await incrementRemixVersion(remixVersion);
  // TODO: After testing a few times, execute git push as a part of the flow and
  // remove the silly message
  console.log(
    chalk.green(`Version ${remixVersion} is ready to roll.`) +
      "\n" +
      chalk.yellow(`Ryan says since I'm just a 👶 script you probably shouldn't trust me *too* much just yet (he's right, I know!)

Run ${chalk.bold(`git push origin ${releaseBranch} --follow-tags`)}`)
  );
  // execSync(`git push origin ${releaseBranch} --follow-tags`);
}

/**
 * @param {string} remixVersion
 * @param {GitAttributes} git
 */
async function execBump(remixVersion, git) {
  ensureReleaseBranch(git.initialBranch);
  await incrementRemixVersion(remixVersion);
  // TODO: After testing a few times, execute git push as a part of the flow and
  // remove the silly message
  console.log(
    chalk.green(`Version ${remixVersion} is ready to roll.`) +
      "\n" +
      chalk.yellow(`Ryan says since I'm just a 👶 script you probably shouldn't trust me *too* much just yet (he's right, I know!)

Run ${chalk.bold(`git push origin ${git.initialBranch} --follow-tags`)}`)
  );
  // execSync(`git push origin ${git.initialBranch} --follow-tags`);
}

/**
 * @param {string} remixVersion
 * @param {GitAttributes} git
 */
async function execFinish(remixVersion, git) {
  ensureReleaseBranch(git.initialBranch);
  await gitMerge(git.initialBranch, "main");
  await incrementRemixVersion(remixVersion);
  await gitMerge(git.initialBranch, "dev");
}

/**
 * @param {string} from
 * @param {string} to
 * @param {{ pullFirst?: boolean }} [opts]
 */
async function gitMerge(from, to, opts = {}) {
  let initialBranch = getCurrentBranch();
  execSync(`git checkout ${from}`);
  if (opts.pullFirst) {
    await gitPull(from);
  }
  execSync(`git checkout ${to}`);

  let savedError;
  /** @type {import('simple-git').MergeResult} */
  let summary;
  try {
    summary = await git.merge([from]);
  } catch (error) {
    savedError = error;
    // @ts-ignore
    summary = error.git;
  }

  if (summary.conflicts.length > 0) {
    let answer = await prompt(
      `Merge conflicts detected. Resolve all conflicts and commit the changes before resuming the process.
          ${chalk.bold("Press Y to continue or N to cancel the release.")}`
    );
    if (answer === false) return 0;
  } else if (savedError) {
    console.error(chalk.red("Merge failed.\n"));
    throw savedError;
  }

  execSync(`git checkout ${initialBranch}`);
}

/**
 * @param {string} branch
 * @returns
 */
async function gitPull(branch) {
  try {
    let resp = execSync(`git pull --rebase origin ${branch}`).toString();
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
  } catch (error) {
    console.error(chalk.red(`Error rebasing to origin/${branch}`));
    throw error;
  }
}

/**
 * @param {string | undefined} currentVersion
 * @param {string} givenVersion
 * @param {string | undefined} [prereleaseId]
 */
function getRemixVersion(currentVersion, givenVersion, prereleaseId = "pre") {
  if (givenVersion == null) {
    throw Error(
      "Missing remix version. Usage: node scripts/release.js start [remixVersion]"
    );
  }
  // @ts-ignore
  let remixVersion = semver.inc(currentVersion, givenVersion, prereleaseId);
  if (remixVersion == null) {
    throw Error(`Invalid version specifier: ${givenVersion}`);
  }
  return remixVersion;
}

function getCurrentBranch() {
  let output = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
  return output;
}

/**
 * @param {string} output
 * @returns {boolean}
 */
function hasMergeConflicts(output) {
  let lines = output.trim().split("\n");
  return lines.some((line) => /^CONFLICT\s/.test(line));
}

/**
 * @param {string} output
 * @returns {boolean}
 */
function mergeFailed(output) {
  let lines = output.trim().split("\n");
  return lines.some((line) => /^Automatic merge failed;\s/.test(line));
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

function getAllTags() {
  return execSync("git tag --list").toString().trim().split("\n");
}

/**
 * @param {string} branch
 * @returns {"dev"}
 */
function ensureDevBranch(branch) {
  if (branch !== "dev") {
    throw Error("Releases should be created from the dev branch.");
  }
  return branch;
}

/**
 * @param {string} branch
 */
function ensureReleaseBranch(branch) {
  let version = getVersionFromReleaseBranch(branch);
  if (version == null || !semver.valid(version)) {
    throw Error(
      "You must be on a valid release branch when continuing the release process."
    );
  }
  return version;
}

/**
 * @param {string} branch
 * @param {GitAttributes} git
 */
function ensureLatestReleaseBranch(branch, git) {
  let versionFromBranch = ensureReleaseBranch(branch);
  let taggedVersions = git.tags
    .filter((tag) => /^v\d/.test(tag))
    .sort(semver.compare);

  let latestTaggedVersion = taggedVersions[taggedVersions.length - 1];
  if (semver.compare(latestTaggedVersion, versionFromBranch) > 0) {
    throw Error(
      "You must be on the latest release branch when continuing the release process."
    );
  }
}

/**
 * @param {string} branch
 * @returns {string}
 */
function getVersionFromReleaseBranch(branch) {
  return branch.slice(branch.indexOf("-") + 2);
}

/**
 * @param {string} version
 */
function getVersionTag(version) {
  return (version.startsWith("v") ? "" : "v") + version;
}

/**
 * @param {string} version
 */
function getReleaseBranch(version) {
  return `release-${getVersionTag(
    version.includes("-") ? version.slice(0, version.indexOf("-")) : version
  )}`;
}

/**
 * @param {string[]} tags
 * @param {string} version
 */
function versionExists(tags, version) {
  return tags.includes(getVersionTag(version));
}

/**
 * @typedef {{ tags: string[]; initialBranch: string }} GitAttributes
 */
