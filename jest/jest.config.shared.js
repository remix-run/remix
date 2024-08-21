const ignorePatterns = [
  "\\/build\\/",
  "\\/coverage\\/",
  "\\/\\.vscode\\/",
  "\\/\\.tmp\\/",
  "\\/\\.cache\\/",
];

/** @type {import('jest').Config} */
module.exports = {
  modulePathIgnorePatterns: ignorePatterns,
  setupFiles: ["<rootDir>/__tests__/setup.ts"],
  testMatch: ["<rootDir>/**/*-test.[jt]s?(x)"],
  transform: {
    "\\.[jt]sx?$": require.resolve("./transform"),
  },
  watchPathIgnorePatterns: [...ignorePatterns, "\\/node_modules\\/"],
  watchPlugins: [
    require.resolve("jest-watch-select-projects"),
    require.resolve("jest-watch-typeahead/filename"),
    require.resolve("jest-watch-typeahead/testname"),
  ],
};
