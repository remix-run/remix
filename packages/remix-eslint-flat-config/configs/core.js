import {
  browser as browserGlobals,
  commonjs as commonjsGlobals,
  es6 as es6Globals,
} from "globals";

import { coreRules } from "../rules/core";
import { importRules } from "../rules/import";
import { reactRules } from "../rules/react";
import { jsxA11yRules } from "../rules/jsx-a11y";
import { importSettings } from "../settings/import";
import { reactSettings } from "../settings/react";

export const coreConfig = [
  {
    files: ["**/*.js", "**/*.mjs"],
    parser: "@babel/eslint-parser",
    parserOptions: {
      sourceType: "module",
      requireConfigFile: false,
      ecmaVersion: "latest",
      babelOptions: {
        presets: [require.resolve("@babel/preset-react")],
      },
    },
    languageOptions: {
      ...browserGlobals,
      ...commonjsGlobals,
      ...es6Globals,
    },
    plugins: ["import", "react", "react-hooks", "jsx-a11y"],
    settings: {
      ...reactSettings,
      ...importSettings,
    },
    // NOTE: In general - we want to use prettier for the majority of stylistic
    // concerns.  However there are some "stylistic" eslint rules we use that should
    // not fail a PR since we can auto-fix them after merging to dev.  These rules
    // should be set to WARN.
    //
    // ERROR should be used for "functional" rules that indicate a problem in the
    // code, and these will cause a PR failure

    // IMPORTANT: Ensure that rules used here are compatible with
    // typescript-eslint. If they are not, we need to turn the rule off in our
    // overrides for ts/tsx.

    // To read the details for any rule, see https://eslint.org/docs/rules/[RULE-KEY]
    rules: { ...coreRules, ...importRules, ...reactRules, ...jsxA11yRules },
  },
];
