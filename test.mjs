// 1. get all commits between current and last tag that changed ./packages using `git`
// 2. check if commit is a PR and get the number using `gh`
// 3. get issues that are referenced in the PR using `gh api`
// 4. comment on PRs and issues with the release version using `gh issue comment` and `gh pr comment`
// 5. close issues that are referenced in the PRs using `gh issue close`

import { execa } from "execa";
import semver from "semver";

// TODO: actually use the dry run flag
let DRY_RUN = true; // process.env.DRY_RUN;

if (!DRY_RUN) {
  console.log("NOT DRY RUN\n\n", "you have 5 seconds to cancel");
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}

let tagCommand = [
  "tag",
  "-l",
  "remix@*",
  "v0.0.0-nightly-*",
  "--sort",
  "-creatordate",
  "--format",
  "%(refname:strip=2)",
];

let gitTagsResult = await execa("git", tagCommand);

if (gitTagsResult.stderr) {
  console.error(gitTagsResult.stderr);
  process.exit(gitTagsResult.exitCode);
}

let gitTags = gitTagsResult.stdout
  .split("\n")
  .slice(1) // TODO: remove - just testing various scenarios
  .map((tag) => {
    let clean = tag.replace(/^remix@/, "");
    return { tag, clean };
  });

let [latest, previous] = gitTags;

console.log({ latest, previous });

let isStable = semver.prerelease(latest.clean) === null;
let isNightly = latest.clean.startsWith("v0.0.0-nightly-");
let isPreRelease = !isStable && !isNightly;

// if prerelease && pre.0 OR stable, then we need to get the previous stable version
// if pre.x, then we need to get the previous pre.x version
if (isPreRelease) {
  console.log(`pre-release: ${latest.clean}`);
  let preRelease = semver.prerelease(latest.clean);
  if (preRelease.join(".") === "pre.0") {
    console.log(`first pre-release: ${latest.clean}`);
    let stable = gitTags.find((tag) => {
      return semver.prerelease(tag.clean) === null;
    });
    console.log(`stable: ${stable.clean}`);
    previous = stable;
  }
} else if (isStable) {
  console.log(`stable: ${latest.clean}`);
  let stable = gitTags.find((tag) => {
    return semver.prerelease(tag.clean) === null && tag.clean !== latest.clean;
  });
  previous = stable;
} else {
  console.log(`nightly: ${latest.clean}`);
}

console.log({
  latest,
  previous,
  isPreRelease,
  isStable,
  isNightly,
});

/**
 * @param {string} start
 * @param {string} end
 * @returns {string[]} command to use with execa
 */
function getCommitsCommand(start, end) {
  return ["log", "--pretty=format:%H", `${start}...${end}`, "./packages"];
}

let gitCommitsResult = await execa(
  "git",
  getCommitsCommand(previous.tag, latest.tag)
);

if (gitCommitsResult.stderr) {
  console.error(gitCommitsResult.stderr);
  process.exit(gitCommitsResult.exitCode);
}

let gitCommits = gitCommitsResult.stdout.split("\n");

console.log({ commitCount: gitCommits.length });

/**
 * @param {string} sha
 * @returns {string[]} command to use with execa
 */
function getPrListCommand(sha) {
  return [
    "pr",
    "list",
    "--search",
    sha,
    "--state",
    "merged",
    "--json",
    "number,title",
  ];
}

let prs = await findMergedPRs(gitCommits);
console.log(prs);

for (let pr of prs) {
  let comment = `🤖 Hello there,\n\nWe just published version \`${latest.clean}\` which includes this pull request. If you'd like to take it for a test run please try it out and let us know what you think!\n\nThanks!`;

  let commentCommand = ["pr", "comment", pr, "--body", comment];

  if (!DRY_RUN) {
    let commentResult = await execa("gh", commentCommand);
    if (commentResult.stderr) {
      console.error(commentResult.stderr);
    }
  }
}

/**
 * @param {string[]} commits
 * @returns {Promise<number[]>}
 */
function findMergedPRs(commits) {
  let CHANGESET_PR_TITLES = [
    "chore: update version for release",
    "chore: update version for release (pre)",
  ];
  let result = commits.map(async (commit) => {
    let prCommand = getPrListCommand(commit);

    let prResult = await execa("gh", prCommand);
    // TODO: remove log
    console.log(prResult.stdout);
    if (prResult.stderr) {
      console.error(prResult.stderr);
      throw new Error(prResult.stderr);
    }
    let [pr] = JSON.parse(prResult.stdout);
    if (!pr || CHANGESET_PR_TITLES.includes(pr.title.toLowerCase())) {
      return;
    }

    return pr.number;
  });

  return Promise.all(result).then((prs) => {
    return prs.filter(Boolean);
  });
}
