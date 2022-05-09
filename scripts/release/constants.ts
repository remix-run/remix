if (!process.env.DEFAULT_BRANCH) {
  throw new Error("DEFAULT_BRANCH is required");
}
if (!process.env.DEV_BRANCH) {
  throw new Error("DEV_BRANCH is required");
}
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
export const REF = process.env.VERSION.replace("refs/tags/", "");
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
export const DEFAULT_BRANCH = process.env.DEFAULT_BRANCH;
export const DEV_BRANCH = process.env.DEV_BRANCH;
export const PR_FILES_STARTS_WITH = ["packages/"];
diff --git a/scripts/release/constants.mjs b/scripts/release/constants.mjs
