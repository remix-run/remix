// TODO: Do NOT run the fixtures dir through Babel. That's cheating.

module.exports = {
  projects: [
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
      displayName: "react",
      testMatch: ["<rootDir>/packages/react/**/*-test.[jt]s?(x)"]
    }
  ]
};
