/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  ...require("../../jest/jest.config.shared"),
  displayName: "scripts",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setupAfterEnv.ts"],
  setupFiles: [],
};
