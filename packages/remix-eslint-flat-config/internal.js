/**
 * This config is intended for internal Remix projects. It should not be
 * documented nor considered public API in regards to semver considerations.
 */
import { coreConfig, testingLibraryConfig } from "./index";

const OFF = 0;
const WARN = 1;
const ERROR = 2;

export const internalConfig = [
  {
    files: ["**/*.js"],
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
      ...coreConfig,
      ...testingLibraryConfig,
      "@typescript-eslint/consistent-type-imports": ERROR,
      "import/order": [
        ERROR,
        {
          "newlines-between": "always",
          groups: [
            ["builtin", "external", "internal"],
            ["parent", "sibling", "index"],
          ],
        },
      ],
      "jest/no-disabled-tests": OFF,
      "prefer-let/prefer-let": WARN,
    },
  },
  {
    // all code blocks in .md files
    files: ["**/*.md/*.js?(x)", "**/*.md/*.ts?(x)"],
    rules: {
      "no-unreachable": OFF,
      "no-unused-expressions": OFF,
      "no-unused-labels": OFF,
      "no-unused-vars": OFF,
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
      "@typescript-eslint/no-unused-expressions": OFF,
      "@typescript-eslint/no-unused-vars": OFF,
    },
  },
  {
    files: [
      // All examples and docs, including code blocks in .md files
      "examples/**/*.js?(x)",
      "examples/**/*.ts?(x)",
    ],
    rules: {
      "import/order": OFF,
      "no-unused-expressions": OFF,
      "no-unused-labels": OFF,
      "no-unused-vars": OFF,
      "prefer-let/prefer-let": OFF,
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
  },
];
