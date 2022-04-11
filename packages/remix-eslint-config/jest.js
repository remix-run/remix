const jestRules = require("./rules/jest");

/**
 * @see https://github.com/eslint/eslint/issues/3458
 * @see https://www.npmjs.com/package/@rushstack/eslint-patch
 */
require("@rushstack/eslint-patch/modern-module-resolution");

/**
 * @deprecated Use `@remix-run/eslint-config/jest-testing-library` instead.
 */
const jestConfig = {
  plugins: ["jest"],
  env: {
    node: true,
  },
  overrides: [
    {
      files: ["**/__tests__/**/*", "**/*.{spec,test}.*"],
      env: {
        "jest/globals": true,
      },
      rules: {
        ...jestRules,
      },
    },
  ],
};

module.exports = jestConfig;
