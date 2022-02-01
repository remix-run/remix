module.exports = {
  modulePathIgnorePatterns: ["<rootDir>/examples"],
  projects: [
    {
      displayName: "create-remix",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/create-remix/**/*-test.[jt]s?(x)"],
      globalSetup: "<rootDir>/jest/buildRemix.ts",
      setupFilesAfterEnv: [
        "<rootDir>/packages/create-remix/__tests__/setupAfterEnv.ts"
      ]
    },
    {
      displayName: "remix-architect",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-architect/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-architect/__tests__/setup.ts"]
    },
    {
      displayName: "remix-deno",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/packages/remix-deno/**/*-test.[jt]s?(x)"],
      moduleNameMapper: {
        "https://deno.land/std/path/mod.ts":
          "<rootDir>/packages/remix-deno/__tests__/pathMock.ts"
      },
      setupFiles: ["<rootDir>/packages/remix-deno/__tests__/setup.ts"]
    },
    {
      displayName: "remix-dev",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-dev/**/*-test.[jt]s?(x)"]
    },
    {
      displayName: "remix-express",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-express/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-express/__tests__/setup.ts"]
    },
    {
      displayName: "remix-netlify",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-netlify/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-netlify/__tests__/setup.ts"]
    },
    {
      displayName: "remix-node",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-node/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-node/__tests__/setup.ts"]
    },
    {
      displayName: "remix-react",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/packages/remix-react/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-react/__tests__/setup.ts"]
    },
    {
      displayName: "remix-server-runtime",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/packages/remix-server-runtime/**/*-test.[jt]s?(x)"
      ],
      setupFiles: ["<rootDir>/packages/remix-server-runtime/__tests__/setup.ts"]
    },
    {
      displayName: "remix-vercel",
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/remix-vercel/**/*-test.[jt]s?(x)"],
      setupFiles: ["<rootDir>/packages/remix-vercel/__tests__/setup.ts"]
    },
    // Fixture Apps
    {
      displayName: "gists-app",
      testEnvironment: "node",
      testMatch: ["<rootDir>/fixtures/gists-app/**/*-test.[jt]s?(x)"],
      globalSetup: "<rootDir>/fixtures/gists-app/jest/globalSetup.ts",
      globalTeardown: "<rootDir>/fixtures/gists-app/jest/globalTeardown.ts",
      setupFiles: ["<rootDir>/fixtures/gists-app/jest/setup.ts"],
      setupFilesAfterEnv: ["<rootDir>/fixtures/gists-app/jest/setupAfterEnv.ts"]
    }
  ],
  watchPlugins: [
    require.resolve("jest-watch-select-projects"),
    require.resolve("jest-watch-typeahead/filename"),
    require.resolve("jest-watch-typeahead/testname")
  ]
};
