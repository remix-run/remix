module.exports = {
  extends: ["react-app", "plugin:import/typescript"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  settings: {
    "import/resolver": {
      typescript: {}
    }
  },
  overrides: [
    {
      files: [
        "packages/create-remix/templates/cloudflare-workers/**/*.js",
        "packages/remix-cloudflare-workers/**/*.ts"
      ],
      rules: {
        "no-restricted-globals": "off"
      }
    }
  ],
  rules: {
    "@typescript-eslint/consistent-type-imports": "error",

    "import/order": [
      "error",
      {
        "newlines-between": "always",
        groups: [
          ["builtin", "external", "internal"],
          ["parent", "sibling", "index"]
        ]
      }
    ]
  }
};
