import { Octokit as RestOctokit } from "@octokit/rest";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { graphql } from "@octokit/graphql";

import { GITHUB_TOKEN, GITHUB_REPOSITORY } from "./constants.mjs";

const graphqlWithAuth = graphql.defaults({
  headers: { authorization: `token ${GITHUB_TOKEN}` },
});

const Octokit = RestOctokit.plugin(paginateRest);
const octokit = new Octokit({ auth: GITHUB_TOKEN });

const gql = String.raw;

export async function prsMergedSinceLast({
  owner,
  repo,
  lastRelease: lastReleaseVersion,
}) {
  let releases = await octokit.paginate(octokit.rest.repos.listReleases, {
    owner,
    repo,
    per_page: 100,
  });

  let sorted = releases.sort((a, b) => {
    return new Date(b.published_at) - new Date(a.published_at);
  });

  let lastReleaseIndex = sorted.findIndex((release) => {
    return release.tag_name === lastReleaseVersion;
  });

  let lastRelease = sorted[lastReleaseIndex];
  if (!lastRelease) {
    throw new Error(
      `Could not find last release ${lastRelease} in ${GITHUB_REPOSITORY}`
    );
  }

  // if the lastRelease was a stable release, then we want to find the previous stable release
  let previousReleaseIndex;
  if (lastRelease.prerelease === false) {
    let minusLatestRelease = [
      ...sorted.slice(0, lastReleaseIndex),
      ...sorted.slice(lastReleaseIndex + 1),
    ];
    previousReleaseIndex = minusLatestRelease.findIndex((release) => {
      return release.prerelease === false;
    });
  } else {
    previousReleaseIndex = lastReleaseIndex + 1;
  }

  let previousRelease = sorted.at(previousReleaseIndex);
  if (!previousRelease) {
    throw new Error(`Could not find previous release in ${GITHUB_REPOSITORY}`);
  }

  let startDate = new Date(previousRelease.created_at);
  let endDate = new Date(lastRelease.created_at);

  let prs = await octokit.paginate(octokit.pulls.list, {
    owner,
    repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
  });

  return prs.filter((pullRequest) => {
    if (!pullRequest.merged_at) return false;
    let mergedDate = new Date(pullRequest.merged_at);
    return mergedDate > startDate && mergedDate < endDate;
  });
}

export async function commentOnPullRequest({ owner, repo, pr, version }) {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pr,
    body: `🤖 Hello there,\n\nWe just published version \`${version}\` which includes this pull request. If you'd like to take it for a test run please try it out and let us know what you think!\n\nThanks!`,
  });
}

export async function commentOnIssue({ owner, repo, issue, version }) {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issue,
    body: `🤖 Hello there,\n\nWe just published version \`${version}\` which involves this issue. If you'd like to take it for a test run please try it out and let us know what you think!\n\nThanks!`,
  });
}

export async function getIssuesClosedByPullRequests(prHtmlUrl) {
  let res = await graphqlWithAuth(gql`
    {
      resource(url: "${prHtmlUrl}") {
        ... on PullRequest {
          closingIssuesReferences(first: 100) {
            nodes {
              number
            }
          }
        }
      }
    }
  `);

  return res?.resource?.closingIssuesReferences?.nodes;
}
