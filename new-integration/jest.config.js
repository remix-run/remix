/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  ...require("../jest/jest.config.shared"),
  displayName: "NEW INTEGRATION",
  setupFilesAfterEnv: ["<rootDir>/setupAfterEnv.ts"],
  setupFiles: [],
  testEnvironment: "jsdom",
};
