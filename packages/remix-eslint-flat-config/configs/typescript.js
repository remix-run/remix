import { typescriptRules, typescriptJSXRules } from "../rules/typescript";

export const typescriptConfig = [
  {
    files: ["**/*.ts?(x)"],
    extends: ["plugin:import/typescript"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
      sourceType: "module",
      ecmaFeatures: {
        jsx: true,
      },
      warnOnUnsupportedTypeScriptVersion: true,
    },
    languageOptions: {
      ecmaVersion: 2019,
    },
    plugins: ["@typescript-eslint"],
    rules: typescriptRules,
  },
  {
    files: ["**/routes/**/*.js?(x)", "**/routes/**/*.tsx"],
    rules: typescriptJSXRules,
  },
];
