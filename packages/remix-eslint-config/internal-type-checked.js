const typeCheckedRules = require("./rules/type-checked");

/**
 * @see https://github.com/eslint/eslint/issues/3458
 * @see https://www.npmjs.com/package/@rushstack/eslint-patch
 */
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  plugins: [],
  overrides: [
    {
      files: [
        "packages/**/*.ts?(x)",
        "templates/**/*.ts?(x)",
        "scripts/playground/**/*.ts?(x)",
      ],
      excludedFiles: ["**/*.md/**"],
      rules: {
        ...typeCheckedRules,
      },
      parser: "@typescript-eslint/parser",
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: [
          "../*/tsconfig.json",
          "../../templates/*/tsconfig.json",
          "../../scripts/playground/template/tsconfig.json",
          "../../tsconfig.eslint.json",
        ],
      },
    },
  ],
};
