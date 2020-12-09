module.exports = {
  projects: [
    {
      displayName: "architect",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/architect/**/*-test.[jt]s?(x)"]
    },
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
      displayName: "express",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/express/**/*-test.[jt]s?(x)"]
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
