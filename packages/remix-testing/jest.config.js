/** @type {import('jest').Config} */
module.exports = {
  ...require("../../jest/jest.config.shared"),
  displayName: "testing",
  setupFiles: [],
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["./jest.setup.js", "@testing-library/jest-dom"],
};
