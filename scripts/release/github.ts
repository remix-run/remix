import type { RestEndpointMethodTypes } from "@octokit/rest";
import * as semver from "semver";

import {
  PR_FILES_STARTS_WITH,
  NIGHTLY_BRANCH,
  DEFAULT_BRANCH,
  PACKAGE_VERSION_TO_FOLLOW,
} from "./constants";
import { gql, graphqlWithAuth, octokit } from "./octokit";
import { cleanupTagName, MinimalTag } from "./utils";
import { checkIfStringStartsWith, sortByDate } from "./utils";

type PullRequest =
  RestEndpointMethodTypes["pulls"]["list"]["response"]["data"][number];

type PullRequestFiles =
  RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"];

interface PrsMergedSinceLastTagOptions {
  owner: string;
  repo: string;
  githubRef: string;
}

interface PrsMergedSinceLastTagResult {
  merged: Awaited<ReturnType<typeof getPullRequestWithFiles>>;
  previousTag: string;
}

export async function prsMergedSinceLastTag({
  owner,
  repo,
  githubRef,
}: PrsMergedSinceLastTagOptions): Promise<PrsMergedSinceLastTagResult> {
  let tags = await getAllTags(owner, repo);
  let { currentTag, previousTag } = getPreviousTagFromCurrentTag(
    githubRef,
    tags
  );

  /**
    nightly > nightly => 'dev'
    nightly > stable => 'main'
    stable > nightly => 'dev'
   */
  let prs: Awaited<ReturnType<typeof getMergedPRsBetweenTags>> = [];

  // if both the current and previous tags are prereleases
  // we can just get the PRs for the "dev" branch
  // but if one of them is stable, we should wind up all of them from both the main and dev branches
  if (currentTag.isPrerelease && previousTag.isPrerelease) {
    prs = await getMergedPRsBetweenTags(
      owner,
      repo,
      previousTag,
      currentTag,
      NIGHTLY_BRANCH
    );
  } else {
    let [nightly, stable] = await Promise.all([
      getMergedPRsBetweenTags(
        owner,
        repo,
        previousTag,
        currentTag,
        NIGHTLY_BRANCH
      ),
      getMergedPRsBetweenTags(
        owner,
        repo,
        previousTag,
        currentTag,
        DEFAULT_BRANCH
      ),
    ]);
    prs = nightly.concat(stable);
  }

  let prsThatTouchedFiles = await getPullRequestWithFiles(owner, repo, prs);

  return {
    merged: prsThatTouchedFiles,
    previousTag: previousTag.tag,
  };
}

type PullRequestWithFiles = PullRequest & {
  files: PullRequestFiles;
};

async function getPullRequestWithFiles(
  owner: string,
  repo: string,
  prs: Array<PullRequest>
): Promise<Array<PullRequestWithFiles>> {
  let prsWithFiles = await Promise.all(
    prs.map(async (pr) => {
      let files = await octokit.paginate(octokit.pulls.listFiles, {
        owner,
        repo,
        per_page: 100,
        pull_number: pr.number,
      });

      return { ...pr, files };
    })
  );

  return prsWithFiles.filter((pr) => {
    return pr.files.some((file) => {
      return checkIfStringStartsWith(file.filename, PR_FILES_STARTS_WITH);
    });
  });
}

function getPreviousTagFromCurrentTag(
  currentTag: string,
  tags: Awaited<ReturnType<typeof getAllTags>>
): {
  previousTag: MinimalTag;
  currentTag: MinimalTag;
} {
  let validTags = tags
    .filter((tag) => {
      // if we have a `PACKAGE_VERSION_TO_FOLLOW`
      // we only want to get the tags related to it
      if (PACKAGE_VERSION_TO_FOLLOW) {
        return tag.name.startsWith(PACKAGE_VERSION_TO_FOLLOW);
      }
      return true;
    })
    .map((tag) => {
      let tagName = cleanupTagName(tag.name);
      let isPrerelease = semver.prerelease(tagName) !== null;

      if (!tag.commit.committer?.date) return null;

      return {
        tag: tagName,
        date: new Date(tag.commit.committer.date),
        isPrerelease,
      };
    })
    .filter((v: any): v is MinimalTag => typeof v !== "undefined")
    .sort(sortByDate);

  let tmpCurrentTagIndex = validTags.findIndex((tag) => tag.tag === currentTag);
  let tmpCurrentTagInfo = validTags.at(tmpCurrentTagIndex);

  if (!tmpCurrentTagInfo) {
    throw new Error(`Could not find last tag ${currentTag}`);
  }

  let currentTagInfo: MinimalTag | undefined;
  let previousTagInfo: MinimalTag | undefined;

  // if the currentTag was a stable tag, then we want to find the previous stable tag
  if (!tmpCurrentTagInfo.isPrerelease) {
    let stableTags = validTags
      .filter((tag) => !tag.isPrerelease)
      .sort((a, b) => semver.rcompare(a.tag, b.tag));

    let stableTagIndex = stableTags.findIndex((tag) => tag.tag === currentTag);
    currentTagInfo = stableTags.at(stableTagIndex);
    if (!currentTagInfo) {
      throw new Error(`Could not find last stable tag ${currentTag}`);
    }

    previousTagInfo = stableTags.at(stableTagIndex + 1);
    if (!previousTagInfo) {
      throw new Error(`Could not find previous stable tag from ${currentTag}`);
    }

    return { currentTag: currentTagInfo, previousTag: previousTagInfo };
  }

  currentTagInfo = tmpCurrentTagInfo;
  if (!currentTagInfo) {
    throw new Error(`Could not find last tag ${currentTag}`);
  }

  previousTagInfo = validTags.at(tmpCurrentTagIndex + 1);
  if (!previousTagInfo) {
    throw new Error(
      `Could not find previous prerelease tag from ${currentTag}`
    );
  }

  return {
    currentTag: currentTagInfo,
    previousTag: previousTagInfo,
  };
}

async function getMergedPRsBetweenTags(
  owner: string,
  repo: string,
  startTag: MinimalTag,
  endTag: MinimalTag,
  baseRef: string,
  page: number = 1,
  nodes: Array<PullRequest> = []
): Promise<Array<PullRequest>> {
  let pulls = await octokit.pulls.list({
    owner,
    repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: 100,
    page,
    base: baseRef,
  });

  let merged = pulls.data.filter((pull) => {
    if (!pull.merged_at) return false;
    let mergedDate = new Date(pull.merged_at);
    return mergedDate > startTag.date && mergedDate < endTag.date;
  });

  if (pulls.data.length !== 0) {
    return getMergedPRsBetweenTags(
      owner,
      repo,
      startTag,
      endTag,
      baseRef,
      page + 1,
      [...nodes, ...merged]
    );
  }

  return [...nodes, ...merged];
}

// TODO: we might be able to get away with just getting up until the "latest" tag
async function getAllTags(owner: string, repo: string) {
  let tags = await octokit.paginate(octokit.rest.repos.listTags, {
    owner,
    repo,
  });

  return await Promise.all(
    tags.map(async (tag) => {
      let commit = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: tag.commit.sha,
      });

      return {
        ...tag,
        commit: commit.data.commit,
      };
    })
  );
}

export async function getIssuesClosedByPullRequests(
  prHtmlUrl: string,
  prBody: string | null
): Promise<Array<number>> {
  let linkedIssues = await getIssuesLinkedToPullRequest(prHtmlUrl);
  if (!prBody) return linkedIssues.map((issue) => issue.number);

  /**
   * This regex matches for one of github's issue references for auto linking an issue to a PR
   * as that only happens when the PR is sent to the default branch of the repo
   * https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword
   */
  let regex =
    /(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)(:)?\s#([0-9]+)/gi;
  let matches = prBody.match(regex);
  if (!matches) return linkedIssues.map((issue) => issue.number);

  let issues = matches.map((match) => {
    let [, issueNumber] = match.split(" #");
    return { number: parseInt(issueNumber, 10) };
  });

  return [...linkedIssues, ...issues.filter((issue) => issue !== null)].map(
    (issue) => issue.number
  );
}

interface GitHubClosingIssueReference {
  resource: {
    closingIssuesReferences: {
      pageInfo: {
        endCursor: string;
        hasNextPage: boolean;
      };
      nodes: Array<{ number: number }>;
    };
  };
}

async function getIssuesLinkedToPullRequest(
  prHtmlUrl: string,
  nodes: Array<{ number: number }> = [],
  after?: string
): Promise<Array<{ number: number }>> {
  let res: GitHubClosingIssueReference = await graphqlWithAuth(
    gql`
      query GET_ISSUES_CLOSED_BY_PR($prHtmlUrl: URI!, $after: String) {
        resource(url: $prHtmlUrl) {
          ... on PullRequest {
            closingIssuesReferences(first: 100, after: $after) {
              nodes {
                number
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }
    `,
    { prHtmlUrl, after }
  );

  let newNodes = res?.resource?.closingIssuesReferences?.nodes ?? [];
  nodes.push(...newNodes);

  if (res?.resource?.closingIssuesReferences?.pageInfo?.hasNextPage) {
    return getIssuesLinkedToPullRequest(
      prHtmlUrl,
      nodes,
      res?.resource?.closingIssuesReferences?.pageInfo?.endCursor
    );
  }

  return nodes;
}

export async function commentOnPullRequest({
  owner,
  repo,
  pr,
  version,
}: {
  owner: string;
  repo: string;
  pr: number;
  version: string;
}) {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pr,
    body: `🤖 Hello there,\n\nWe just published version \`${version}\` which includes this pull request. If you'd like to take it for a test run please try it out and let us know what you think!\n\nThanks!`,
  });
}

export async function commentOnIssue({
  owner,
  repo,
  issue,
  version,
}: {
  owner: string;
  repo: string;
  issue: number;
  version: string;
}) {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issue,
    body: `🤖 Hello there,\n\nWe just published version \`${version}\` which involves this issue. If you'd like to take it for a test run please try it out and let us know what you think!\n\nThanks!`,
  });
}
