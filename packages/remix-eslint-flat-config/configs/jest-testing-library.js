import { testingLibraryRules } from "../rules/testing-library";

export const testingLibraryConfig = {
  files: ["**/__tests__/**/*", "**/*.{spec,test}.*"],
  env: {
    "jest/globals": true,
  },
  rules: testingLibraryRules,
};
