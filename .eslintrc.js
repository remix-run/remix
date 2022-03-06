module.exports = {
  root: true,
  extends: [
    require.resolve("./packages/remix-eslint-config/index.js"),
    require.resolve("./packages/remix-eslint-config/jest-testing-library.js"),
    "plugin:markdown/recommended",
  ],
  overrides: [
    {
      // all code blocks in .md files
      files: ["**/*.md/*.js", "**/*.md/*.jsx", "**/*.md/*.ts", "**/*.md/*.tsx"],
      rules: {
        "no-unreachable": "off",
        "prefer-const": "error",
      },
    },
    {
      // all React (.jsx & .tsx) code blocks in .md files
      files: ["**/*.md/*.jsx", "**/*.md/*.tsx"],
      rules: {
        "jsx-a11y/alt-text": "off",
        "jsx-a11y/anchor-has-content": "off",

        "react/jsx-no-undef": "off",
      },
    },
    {
      // all TypeScript (.ts & .tsx) code blocks in .md files
      files: ["**/*.md/*.ts", "**/*.md/*.tsx"],
      rules: {
        "@typescript-eslint/no-unused-expressions": "off",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
    {
      // all test files
      files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx"],
      rules: {
        "jest/no-disabled-tests": "off",
      },
    },
    {
      files: ["fixtures/gists-app/jest/**/*.js"],
      env: {
        "jest/globals": true,
      },
    },
  ],
  rules: {
    "@typescript-eslint/consistent-type-imports": "error",

    "import/order": [
      "error",
      {
        "newlines-between": "always",
        groups: [
          ["builtin", "external", "internal"],
          ["parent", "sibling", "index"],
        ],
      },
    ],
  },
};
