/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  ...require("../jest/jest.config.shared"),
  displayName: "integration",
  preset: "jest-puppeteer",
  globalSetup: "<rootDir>/helpers/global-setup.ts",
  setupFilesAfterEnv: ["<rootDir>/helpers/setupAfterEnv.ts"],
  setupFiles: [],
};
