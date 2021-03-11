module.exports = {
  projects: [
    {
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/node/**/*-test.[jt]s?(x)"]
    },
    {
      displayName: "dev",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/dev/**/*-test.[jt]s?(x)"]
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
      globalTeardown: "<rootDir>/fixtures/gists-app/jest/global-teardown.js",
      setupFilesAfterEnv: ["<rootDir>/fixtures/gists-app/jest/setup.js"]
    }
  ]
};
