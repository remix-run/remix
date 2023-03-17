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

let gitTags = gitTagsResult.stdout.split("\n").map((tag) => {
  let clean = tag.replace(/^remix@/, "");
  return { tag, clean };
});

let [latest, previous] = gitTags;

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
    let stableTags = getStableTags(gitTags);
    previous = stableTags[0];
  }
} else if (isStable) {
  console.log(`stable: ${latest.clean}`);
  let stableTags = getStableTags(gitTags);
  previous = stableTags[1];
} else {
  console.log(`nightly: ${latest.clean}`);
}

console.log({ latest, previous, isPreRelease, isStable, isNightly });

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
    "number,title,url,body",
  ];
}

let prs = await findMergedPRs(gitCommits);
console.log(prs);

for (let pr of prs) {
  let prComment = `🤖 Hello there,\n\nWe just published version \`${latest.clean}\` which includes this pull request. If you'd like to take it for a test run please try it out and let us know what you think!\n\nThanks!`;
  let issueComment = `🤖 Hello there,\n\nWe just published version \`${latest.clean}\` which involves this issue. If you'd like to take it for a test run please try it out and let us know what you think!\n\nThanks!`;

  let promises = [];

  if (!DRY_RUN) {
    let commentCommand = ["pr", "comment", pr, "--body", prComment];
    let commentResult = promises.push(execa("gh", commentCommand));
    if (commentResult.stderr) {
      console.error(commentResult.stderr);
    }

    for (let issue of pr.issues) {
      let issueCommentCommand = [
        "issue",
        "comment",
        issue,
        "--body",
        issueComment,
      ];
      let issueCommentResult = promises.push(execa("gh", issueCommentCommand));
      if (issueCommentResult.stderr) {
        console.error(issueCommentResult.stderr);
      }

      let closeCommand = ["issue", "close", issue];
      let closeResult = promises.push(execa("gh", closeCommand));
      if (closeResult.stderr) {
        console.error(closeResult.stderr);
      }
    }
  }

  let results = await Promise.allSettled(promises);
  let failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    console.error(`the following commands failed:`, failures);
  }
}

/**
 * @param {string} prHtmlUrl
 */
async function getIssuesLinkedToPullRequest(prHtmlUrl) {
  let query =
    "\
    query ($prHtmlUrl: URI!, $endCursor: String) {\
      resource(url: $prHtmlUrl) {\
        ... on PullRequest {\
          closingIssuesReferences(first: 100, after: $endCursor) {\
            nodes {\
              number\
            }\
            pageInfo {\
              hasNextPage\
              endCursor\
            }\
          }\
        }\
      }\
    }\
  ";

  let result = await execa("gh", [
    "api",
    "graphql",
    "--paginate",
    "--field",
    `prHtmlUrl=${prHtmlUrl}`,
    "--raw-field",
    `query=${query}`,
  ]);

  if (result.stderr) {
    console.error(result.stderr);
  }

  console.log(result.stdout);

  let json = JSON.parse(result.stdout);

  return json.data.resource.closingIssuesReferences.nodes.map(
    (node) => node.number
  );
}

/**
 * @param {string} prBody - the body of the PR
 * @returns {Promise<number[]>} - the issue numbers that were closed via the PR body
 */
async function getIssuesClosedViaBody(prBody) {
  if (!prBody) return [];

  /**
   * This regex matches for one of github's issue references for auto linking an issue to a PR
   * as that only happens when the PR is sent to the default branch of the repo
   * https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword
   */
  let regex =
    /(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)(:)?\s#([0-9]+)/gi;

  let matches = prBody.match(regex);
  if (!matches) return [];

  let issuesMatch = matches.map((match) => {
    let [, issueNumber] = match.split(" #");
    return parseInt(issueNumber, 10);
  });

  return issuesMatch;
}

/**
 * @param {string[]} commits
 * @returns {Promise<number[]>}
 */
async function findMergedPRs(commits) {
  let CHANGESET_PR_TITLES = [
    "chore: update version for release",
    "chore: update version for release (pre)",
  ];
  let result = await Promise.all(
    commits.map(async (commit) => {
      let prCommand = getPrListCommand(commit);

      let prResult = await execa("gh", prCommand);
      if (prResult.stderr) {
        console.error(prResult.stderr);
        throw new Error(prResult.stderr);
      }
      let [pr] = JSON.parse(prResult.stdout);
      if (!pr || CHANGESET_PR_TITLES.includes(pr.title.toLowerCase())) {
        return;
      }

      let linkedIssues = await getIssuesLinkedToPullRequest(pr.url);

      let issuesClosedViaBody = await getIssuesClosedViaBody(pr.body);

      console.log({ linkedIssues, issuesClosedViaBody });

      let uniqueIssues = new Set([...linkedIssues, ...issuesClosedViaBody]);

      return {
        number: pr.number,
        issues: [...uniqueIssues],
      };
    })
  );

  return result.filter(Boolean);
}

/**
 * @param {string[]} tags
 * @returns {string[]}
 */
function getStableTags(tags) {
  return tags.filter((tag) => {
    return semver.prerelease(tag.clean) === null;
  });
}
