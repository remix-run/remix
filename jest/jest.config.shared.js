/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/**/*-test.[jt]s?(x)"],
  setupFiles: ["<rootDir>/__tests__/setup.ts"],
  transform: {
    "\\.[jt]sx?$": require.resolve("./transform"),
  },
};
