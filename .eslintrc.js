module.exports = {
  root: true,
  extends: [
    require.resolve("./packages/remix-eslint-config/index.js"),
    require.resolve("./packages/remix-eslint-config/jest-testing-library.js"),
    "plugin:markdown/recommended",
  ],
  overrides: [
    {
      // all ```jsx & ```tsx code blocks in .md files
      files: ["**/*.md/*.js", "**/*.md/*.jsx", "**/*.md/*.ts", "**/*.md/*.tsx"],
      rules: {
        "no-unreachable": "off",
        "jsx-a11y/alt-text": "off",
        "jsx-a11y/anchor-has-content": "off",
        "react/jsx-no-comment-textnodes": "off",
        "react/jsx-no-undef": "off",
      },
    },
    {
      // all ```ts & ```tsx code blocks in .md files
      files: ["**/*.md/*.ts", "**/*.md/*.tsx"],
      rules: {
        "@typescript-eslint/no-unused-expressions": "off",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
    {
      files: [
        "packages/create-remix/templates/cloudflare-workers/**/*.js",
        "packages/remix-cloudflare-workers/**/*.ts",
      ],
      rules: {
        "no-restricted-globals": "off",
      },
    },
    {
      files: ["fixtures/gists-app/jest/**/*.js"],
      env: {
        "jest/globals": true,
      },
    },
    {
      files: ["examples/**/*.js", "examples/**/*.jsx"],
      rules: {
        "no-unused-vars": "off",
      },
    },
    {
      files: ["examples/**/*.ts", "examples/**/*.tsx"],
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
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
    "jest/no-disabled-tests": "off",
  },
};
