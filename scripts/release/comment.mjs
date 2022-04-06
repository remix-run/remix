import {
  commentOnIssue,
  commentOnPullRequest,
  getIssuesClosedByPullRequests,
  prsMergedSinceLast,
} from "./octokit.mjs";
import { LATEST_RELEASE, OWNER, REPO } from "./constants.mjs";

async function commentOnIssuesAndPrsAboutRelease() {
  let pullRequests = await prsMergedSinceLast({
    owner: OWNER,
    repo: REPO,
    lastRelease: LATEST_RELEASE,
  });
  let suffix = pullRequests.length === 1 ? "" : "s";
  console.log(
    `Found ${pullRequests.length} PR${suffix} merged since last release`
  );

  let promises = [];

  for (let pr of pullRequests) {
    console.log(`commenting on pr #${pr.number}`);

    promises.push(
      commentOnPullRequest({
        owner: OWNER,
        repo: REPO,
        pr: pr.number,
        version: LATEST_RELEASE,
      })
    );

    let issuesClosed = await getIssuesClosedByPullRequests(pr.html_url);

    for (let issue of issuesClosed) {
      console.log(`commenting on issue #${issue.number}`);
      promises.push(
        commentOnIssue({
          issue: issue.number,
          owner: OWNER,
          repo: REPO,
          version: LATEST_RELEASE,
        })
      );
    }
  }

  await Promise.all(promises);
}

commentOnIssuesAndPrsAboutRelease();
