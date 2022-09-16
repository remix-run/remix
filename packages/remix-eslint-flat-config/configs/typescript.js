import typescriptParser from "@typescript-eslint/parser";

import { typescriptRules, typescriptJSXRules } from "../rules/typescript";

export const typescriptConfig = [
  {
    files: ["**/*.ts?(x)"],
    extends: ["plugin:import/typescript"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2019,
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        warnOnUnsupportedTypeScriptVersion: true,
      },
    },
    plugins: ["@typescript-eslint"],
    rules: typescriptRules,
  },
  {
    files: ["**/routes/**/*.js?(x)", "**/routes/**/*.tsx"],
    rules: typescriptJSXRules,
  },
];
