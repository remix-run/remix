/** @type {import('jest').Config} */
module.exports = {
  ...require("../../jest/jest.config.shared"),
  displayName: "create-remix",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setupAfterEnv.ts"],
  setupFiles: [],
};
