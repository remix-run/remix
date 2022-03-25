/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  modulePathIgnorePatterns: [
    "<rootDir>/.tmp",
    "<rootDir>/examples",
    "<rootDir>/templates",
  ],
  projects: [
    {
      displayName: "create-remix",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/create-remix/**/*-test.[jt]s?(x)"],
      globalSetup: process.env.CI ? undefined : "<rootDir>/jest/buildRemix.ts",
    },
    {
      displayName: "integration",
      preset: "jest-puppeteer",
      testMatch: ["<rootDir>/integration/**/*-test.[jt]s?(x)"],
      globalSetup: "<rootDir>/integration/helpers/global-setup.ts",
      setupFilesAfterEnv: ["<rootDir>/integration/helpers/setupAfterEnv.ts"],
    },
    {
      displayName: "remix-architect",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-architect/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-architect/__tests__/setup.ts"],
    },
    {
      displayName: "remix-dev",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-dev/**/*-test.[jt]s?(x)"],
      setupFilesAfterEnv: [
        "<rootDir>/packages/remix-dev/__tests__/setupAfterEnv.ts",
      ],
      globalSetup: process.env.CI ? undefined : "<rootDir>/jest/buildRemix.ts",
    },
    {
      displayName: "remix-express",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-express/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-express/__tests__/setup.ts"],
    },
    {
      displayName: "remix-netlify",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-netlify/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-netlify/__tests__/setup.ts"],
    },
    {
      displayName: "remix-node",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-node/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-node/__tests__/setup.ts"],
    },
    {
      displayName: "remix-react",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/packages/remix-react/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-react/__tests__/setup.ts"],
    },
    {
      displayName: "remix-server-runtime",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/packages/remix-server-runtime/**/*-test.[jt]s?(x)",
      ],
      setupFiles: [
        "<rootDir>/packages/remix-server-runtime/__tests__/setup.ts",
      ],
    },
    {
      displayName: "remix-vercel",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-vercel/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-vercel/__tests__/setup.ts"],
    },
    // Fixture Apps
    {
      displayName: "gists-app",
      preset: "jest-puppeteer",
      testMatch: ["<rootDir>/fixtures/gists-app/**/*-test.[jt]s?(x)"],
      globalSetup: "<rootDir>/fixtures/gists-app/jest/globalSetup.ts",
      globalTeardown: "<rootDir>/fixtures/gists-app/jest/globalTeardown.ts",
      setupFiles: ["<rootDir>/fixtures/gists-app/jest/setup.ts"],
      setupFilesAfterEnv: [
        "<rootDir>/fixtures/gists-app/jest/setupAfterEnv.ts",
      ],
    },
  ],
  watchPlugins: [
    require.resolve("jest-watch-select-projects"),
    require.resolve("jest-watch-typeahead/filename"),
    require.resolve("jest-watch-typeahead/testname"),
  ],
};
