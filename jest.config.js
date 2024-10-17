/** @type {import('jest').Config} */
module.exports = {
  modulePathIgnorePatterns: [
    "<rootDir>/.tmp",
    "<rootDir>/examples",
    "<rootDir>/templates",
  ],
  projects: [
    "packages/create-remix",
    "packages/remix",
    "packages/remix-architect",
    "packages/remix-cloudflare",
    "packages/remix-cloudflare-pages",
    "packages/remix-cloudflare-workers",
    "packages/remix-css-bundle",
    "packages/remix-deno",
    "packages/remix-dev",
    "packages/remix-eslint-config",
    "packages/remix-express",
    "packages/remix-node",
    "packages/remix-react",
    "packages/remix-route-config",
    "packages/remix-serve",
    "packages/remix-server-runtime",
    "packages/remix-testing",
  ],
  reporters:
    process.env.GITHUB_ACTIONS == null
      ? ["default"]
      : [["github-actions", { silent: false }], "summary"],
  watchPlugins: [
    require.resolve("jest-watch-select-projects"),
    require.resolve("jest-watch-typeahead/filename"),
    require.resolve("jest-watch-typeahead/testname"),
  ],
};
