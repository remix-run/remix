const jestRules = require("./rules/jest");

/**
 * @see https://github.com/eslint/eslint/issues/3458
 * @see https://www.npmjs.com/package/@rushstack/eslint-patch
 */
require("@rushstack/eslint-patch/modern-module-resolution");

const alreadyWarned = {};
const warnOnce = (condition, message) => {
  if (!condition && !alreadyWarned[message]) {
    alreadyWarned[message] = true;
    console.warn(message);
  }
};

warnOnce(
  false,
  "⚠️ DEPRECATED: The `@remix-run/eslint-config/jest` ESLint config " +
    "has been deprecated in favor of " +
    "`@remix-run/eslint-config/jest-testing-library` and will be removed in " +
    "Remix v2. Please update your code to use " +
    "`@remix-run/eslint-config/jest-testing-library` instead."
);

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
