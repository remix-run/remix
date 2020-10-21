module.exports = {
  projects: [
    {
      displayName: "cli",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/cli/**/*-test.[jt]s?(x)"]
    },
    {
      displayName: "core",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/core/**/*-test.[jt]s?(x)"]
    },
    {
      displayName: "gists-app",
      testEnvironment: "node",
      testMatch: ["<rootDir>/fixtures/gists-app/**/*-test.[jt]s?(x)"],
      globalSetup: "<rootDir>/fixtures/gists-app/jest/global-setup.js",
      globalTeardown: "<rootDir>/fixtures/gists-app/jest/global-teardown.js"
    }
  ]
};
