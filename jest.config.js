/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  modulePathIgnorePatterns: [
    "<rootDir>/.tmp",
    "<rootDir>/examples",
    "<rootDir>/templates",
  ],
  projects: [
    "new-integration",
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
    "packages/remix-netlify",
    "packages/remix-node",
    "packages/remix-react",
    "packages/remix-serve",
    "packages/remix-server-runtime",
    "packages/remix-testing",
    "packages/remix-vercel",
  ],
  watchPlugins: [
    require.resolve("jest-watch-select-projects"),
    require.resolve("jest-watch-typeahead/filename"),
    require.resolve("jest-watch-typeahead/testname"),
  ],
};
