if (!process.env.GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN is required");
}
if (!process.env.GITHUB_REPOSITORY) {
  throw new Error("GITHUB_REPOSITORY is required");
}
if (!process.env.VERSION) {
  throw new Error("VERSION is required");
}
if (!process.env.VERSION.startsWith("refs/tags/")) {
  throw new Error("VERSION must be a tag, received " + process.env.VERSION);
}

export const [OWNER, REPO] = process.env.GITHUB_REPOSITORY.split("/");
export const LATEST_RELEASE = process.env.VERSION.replace("refs/tags/", "");
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

export const PR_FILES_STARTS_WITH = ["packages/"];

/**
 * https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword
 */
export const PR_KEYWORDS = new Set([
  "close",
  "closes",
  "closed",
  "fix",
  "fixes",
  "fixed",
  "resolve",
  "resolves",
  "resolved",
]);
