import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";

import { typescriptRules, typescriptJSXRules } from "../rules/typescript";

export const typescriptConfig = [
  "plugin:import/typescript",
  {
    files: ["**/*.ts?(x)"],
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
    plugins: [typescriptPlugin],
    rules: typescriptRules,
  },
  {
    files: ["**/routes/**/*.js?(x)", "**/routes/**/*.tsx"],
    rules: typescriptJSXRules,
  },
];
