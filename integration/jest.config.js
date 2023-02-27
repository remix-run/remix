/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  ...require("../jest/jest.config.shared"),
  displayName: "integration",
  setupFilesAfterEnv: ["<rootDir>/setupAfterEnv.ts"],
  setupFiles: [],
  testEnvironment: "jsdom",
};
