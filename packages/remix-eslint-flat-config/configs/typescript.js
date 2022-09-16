import { typescriptRules, typescriptJSXRules } from "../rules/typescript";

export const typescriptConfig = [
  {
    files: ["**/*.ts?(x)"],
    extends: ["plugin:import/typescript"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
      sourceType: "module",
      ecmaVersion: 2019,
      ecmaFeatures: {
        jsx: true,
      },
      warnOnUnsupportedTypeScriptVersion: true,
    },
    plugins: ["@typescript-eslint"],
    rules: typescriptRules,
  },
  {
    files: ["**/routes/**/*.js?(x)", "**/routes/**/*.tsx"],
    rules: typescriptJSXRules,
  },
];
