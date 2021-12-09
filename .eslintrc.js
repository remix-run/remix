module.exports = {
  extends: [
    require.resolve("./packages/remix-eslint-config/index.js"),
    require.resolve("./packages/remix-eslint-config/jest.js")
  ],
  overrides: [
    {
      files: [
        "packages/create-remix/templates/cloudflare-workers/**/*.js",
        "packages/remix-cloudflare-workers/**/*.ts"
      ],
      rules: {
        "no-restricted-globals": "off"
      }
    },
    {
      files: ["fixtures/gists-app/jest/**/*.js"],
      env: {
        "jest/globals": true
      }
    }
  ],
  rules: {
    "@typescript-eslint/consistent-type-imports": "error",

    "sort-imports": [
      "error",
      { ignoreCase: true, ignoreDeclarationSort: true }
    ],
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling"],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true
        }
      }
    ]
  }
};
