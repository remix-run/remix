let typescriptExtensions = [".ts", ".tsx"];
let allExtensions = [...typescriptExtensions, ".js", ".jsx"];

module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  settings: {
    "import/extensions": allExtensions,
    "import/external-module-folders": ["node_modules", "node_modules/@types"],
    "import/parsers": {
      "@typescript-eslint/parser": typescriptExtensions
    },
    "import/resolver": {
      node: {
        extensions: allExtensions
      },
      typescript: {}
    }
  },
  rules: {
    "@typescript-eslint/consistent-type-imports": "error"
  }
};
