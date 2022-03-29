/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  ...require("../../jest/jest.config.shared"),
  displayName: "gists-app",
  preset: "jest-puppeteer",
  globalSetup: "<rootDir>/jest/globalSetup.ts",
  globalTeardown: "<rootDir>/jest/globalTeardown.ts",
  setupFiles: ["<rootDir>/jest/setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest/setupAfterEnv.ts"],
};
