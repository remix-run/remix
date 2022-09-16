import { jest as jestGlobals } from "globals";

import { testingLibraryRules } from "../rules/testing-library";

export const unstable__testingLibraryConfig = {
  files: ["**/__tests__/**/*", "**/*.{spec,test}.*"],
  languageOptions: {
    ...jestGlobals,
  },
  rules: testingLibraryRules,
};
