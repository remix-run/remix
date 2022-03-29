/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  ...require("../../jest/jest.config.shared"),
  displayName: "remix-dev",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setupAfterEnv.ts"],
  setupFiles: [],
  globalSetup: process.env.CI
    ? undefined
    : require.resolve("../../jest/buildRemix"),
};
