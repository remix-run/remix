/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  ...require("../../jest/jest.config.shared"),
  displayName: "testing",
  testEnvironment: "./jsdom-fetch-environment.ts",
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
};
