module.exports = {
  extends: ["react-app", "plugin:import/typescript"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2018
  },
  plugins: ["@typescript-eslint", "import"],
  settings: {
    "import/resolver": {
      typescript: {}
    }
  },
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
