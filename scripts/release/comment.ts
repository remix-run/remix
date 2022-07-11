import { REF, OWNER, REPO, PR_FILES_STARTS_WITH } from "./constants";
import {
  commentOnIssue,
  commentOnPullRequest,
  getIssuesClosedByPullRequests,
  prsMergedSinceLastTag,
} from "./github";
import { getGitHubUrl } from "./utils";

async function commentOnIssuesAndPrsAboutRelease() {
  if (REF.includes("experimental")) {
    return;
  }

  let { merged, previousTag } = await prsMergedSinceLastTag({
    owner: OWNER,
    repo: REPO,
    githubRef: REF,
  });

  let suffix = merged.length === 1 ? "" : "s";
  let prFilesDirs = PR_FILES_STARTS_WITH.join(", ");
  console.log(
    `Found ${merged.length} PR${suffix} merged ` +
      `that touched \`${prFilesDirs}\` since ` +
      `previous release (current: ${REF}, previous: ${previousTag})`
  );

  let promises: Array<ReturnType<typeof commentOnIssue>> = [];
  let issuesCommentedOn = new Set();

  for (let pr of merged) {
    console.log(`commenting on pr ${getGitHubUrl("pull", pr.number)}`);

    promises.push(
      commentOnPullRequest({
        owner: OWNER,
        repo: REPO,
        pr: pr.number,
        version: REF,
      })
    );

    let issuesClosed = await getIssuesClosedByPullRequests(
      pr.html_url,
      pr.body
    );

    for (let issueNumber of issuesClosed) {
      if (issuesCommentedOn.has(issueNumber)) {
        // we already commented on this issue
        // so we don't need to do it again
        continue;
      }
      issuesCommentedOn.add(issueNumber);
      console.log(`commenting on issue ${getGitHubUrl("issue", issueNumber)}`);
      promises.push(
        commentOnIssue({
          issue: issueNumber,
          owner: OWNER,
          repo: REPO,
          version: REF,
        })
      );
    }
  }

  await Promise.all(promises);
}

commentOnIssuesAndPrsAboutRelease();
