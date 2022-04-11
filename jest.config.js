/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  modulePathIgnorePatterns: [
    "<rootDir>/.tmp",
    "<rootDir>/examples",
    "<rootDir>/templates",
  ],
  projects: [
    "packages/remix-dev",
    "packages/remix-architect",
    "packages/remix-express",
    "packages/remix-netlify",
    "packages/remix-vercel",
    "packages/remix-node",
    "packages/remix-react",
    "packages/remix-server-runtime",
  ],
  watchPlugins: [
    require.resolve("jest-watch-select-projects"),
    require.resolve("jest-watch-typeahead/filename"),
    require.resolve("jest-watch-typeahead/testname"),
  ],
};
