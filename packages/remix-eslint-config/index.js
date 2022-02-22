// Splitting rules into separate modules allow for a lower-level API if our
// default rules become difficult to extend without lots of duplication.
const coreRules = require("./rules/core");
const importRules = require("./rules/import");
const reactRules = require("./rules/react");
const jsxA11yRules = require("./rules/jsx-a11y");
const typescriptRules = require("./rules/typescript");
const importSettings = require("./settings/import");
const reactSettings = require("./settings/react");

/**
 * @see https://github.com/eslint/eslint/issues/3458
 * @see https://www.npmjs.com/package/@rushstack/eslint-patch
 */
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  parser: "@babel/eslint-parser",
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2019,
    requireConfigFile: false,
    babelOptions: {
      presets: ["@babel/preset-react"],
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true,
  },
  plugins: ["import", "react", "react-hooks", "jsx-a11y"],
  settings: {
    ...reactSettings,
    ...importSettings,
  },

  // NOTE: Omit rules related to code style/formatting. Eslint should report
  // potential problems only.

  // IMPORTANT: Ensure that rules used here are compatible with
  // typescript-eslint. If they are not, we need to turn the rule off in our
  // overrides for ts/tsx.

  // To read the details for any rule, see https://eslint.org/docs/rules/[RULE-KEY]
  rules: {
    ...coreRules,
    ...importRules,
    ...reactRules,
    ...jsxA11yRules,
  },
  overrides: [
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
      rules: {
        ...typescriptRules,
      },
    },
  ],
};
