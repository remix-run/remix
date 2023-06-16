/**
 * This config is intended for internal Remix projects. It should not be
 * documented nor considered public API in regard to semver considerations.
 */

/**
 * @see https://github.com/eslint/eslint/issues/3458
 * @see https://www.npmjs.com/package/@rushstack/eslint-patch
 */
require("@rushstack/eslint-patch/modern-module-resolution");

const OFF = 0;
const WARN = 1;
const ERROR = 2;

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    require.resolve("./index.js"),
    require.resolve("./jest-testing-library.js"),
  ],
  env: {
    node: true,
  },
  plugins: [
    // Plugins used in the internal config should be installed in our
    // repositories. We don't want to ship these as dependencies to consumers
    // who may not use them.
    "node",
    "prefer-let",
  ],
  rules: {
    "@typescript-eslint/consistent-type-imports": ERROR,
    "import/order": [
      ERROR,
      {
        "newlines-between": "always",
        groups: [
          ["builtin", "external"],
          "internal",
          ["parent", "sibling", "index"],
        ],
      },
    ],
    "jest/no-disabled-tests": OFF,
    "prefer-let/prefer-let": WARN,
  },
  overrides: [
    {
      // all code blocks in .md files
      files: ["**/*.md/*.js?(x)", "**/*.md/*.ts?(x)"],
      rules: {
        "no-unreachable": OFF,
        "no-unused-expressions": OFF,
        "no-unused-labels": OFF,
        "no-unused-vars": OFF,
        "prefer-const": WARN,
        "jsx-a11y/alt-text": OFF,
        "jsx-a11y/anchor-has-content": OFF,
        "prefer-let/prefer-let": OFF,
        "react/jsx-no-comment-textnodes": OFF,
        "react/jsx-no-undef": OFF,
      },
    },
    {
      // all ```ts & ```tsx code blocks in .md files
      files: ["**/*.md/*.ts?(x)"],
      rules: {
        "import/no-duplicates": "off",
        "@typescript-eslint/no-unused-expressions": OFF,
        "@typescript-eslint/no-unused-vars": OFF,
      },
    },
    {
      files: ["packages/**/*.*"],
      excludedFiles: "**/__tests__/**/*.*",
      rules: {
        // Validate dependencies are listed in workspace package.json files
        "import/no-extraneous-dependencies": ERROR,
      },
    },
    {
      files: ["integration/**/*.*"],
      env: {
        "jest/globals": false,
      },
      rules: {
        "import/no-duplicates": "off",
      },
    },
  ],
};
