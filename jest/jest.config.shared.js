const ignorePatterns = [
  "\\/build\\/",
  "\\/coverage\\/",
  "\\/\\.vscode\\/",
  "\\/\\.tmp\\/",
  "\\/\\.cache\\/",
];

/** @type {import('jest').Config} */
module.exports = {
  moduleNameMapper: {
    "^@remix-run/web-blob$": require.resolve("@remix-run/web-blob"),
    "^@remix-run/web-fetch$": require.resolve("@remix-run/web-fetch"),
    "^@remix-run/web-file": require.resolve("@remix-run/web-file"),
    "^@remix-run/web-form-data$": require.resolve("@remix-run/web-form-data"),
    "^@remix-run/web-stream$": require.resolve("@remix-run/web-stream"),
    "^@web3-storage/multipart-parser$": require.resolve(
      "@web3-storage/multipart-parser"
    ),
  },
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
