/**
 * @see https://github.com/eslint/eslint/issues/3458
 * @see https://www.npmjs.com/package/@rushstack/eslint-patch
 */
require("@rushstack/eslint-patch/modern-module-resolution");

const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  parser: "@babel/eslint-parser",
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2019,
    requireConfigFile: false,
    babelOptions: {
      presets: ["@babel/preset-react"]
    }
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true
  },
  plugins: ["import", "react", "react-hooks", "jsx-a11y"],
  settings: {
    react: {
      version: "detect"
    },
    "import/ignore": ["node_modules", "\\.(css|md|svg|json)$"],
    "import/parsers": {
      [require.resolve("@typescript-eslint/parser")]: [".ts", ".tsx", ".d.ts"]
    },
    "import/resolver": {
      [require.resolve("eslint-import-resolver-node")]: {
        extensions: [".js", ".jsx", ".ts", ".tsx"]
      },
      [require.resolve("eslint-import-resolver-typescript")]: {
        alwaysTryTypes: true
      }
    }
  },

  // NOTE: Omit rules related to code style/formatting. Eslint should report
  // potential problems only.

  // IMPORTANT: Ensure that rules used here are compatible with
  // typescript-eslint. If they are not, we need to turn the rule off in our
  // overrides for ts/tsx.

  // To read the details for any rule, see https://eslint.org/docs/rules/[RULE-KEY]
  rules: {
    "array-callback-return": WARN,
    "constructor-super": ERROR,
    "getter-return": WARN,
    "new-cap": [WARN, { capIsNew: false, newIsCap: true }],
    "no-array-constructor": WARN,
    "no-caller": ERROR,
    "no-cond-assign": [WARN, "except-parens"],
    "no-const-assign": ERROR,
    "no-dupe-args": WARN,
    "no-dupe-class-members": WARN,
    "no-dupe-keys": WARN,
    "no-duplicate-case": WARN,
    "no-empty-character-class": WARN,
    "no-empty-pattern": WARN,
    "no-duplicate-imports": WARN,
    "no-empty": [WARN, { allowEmptyCatch: true }],
    "no-eval": ERROR,
    "no-ex-assign": WARN,
    "no-extend-native": WARN,
    "no-extra-bind": WARN,
    "no-extra-label": WARN,
    "no-extra-boolean-cast": WARN,
    "no-func-assign": ERROR,
    "no-global-assign": ERROR,
    "no-implied-eval": WARN,
    "no-invalid-regexp": WARN,
    "no-label-var": WARN,
    "no-labels": [WARN, { allowLoop: true, allowSwitch: false }],
    "no-lone-blocks": WARN,
    "no-loop-func": WARN,
    "no-mixed-operators": [
      WARN,
      {
        groups: [
          ["&", "|", "^", "~", "<<", ">>", ">>>"],
          ["==", "!=", "===", "!==", ">", ">=", "<", "<="],
          ["&&", "||"],
          ["in", "instanceof"]
        ],
        allowSamePrecedence: false
      }
    ],
    "no-unsafe-negation": WARN,
    "no-new-func": WARN,
    "no-new-object": WARN,
    "no-octal": WARN,
    "no-redeclare": ERROR,
    "no-script-url": WARN,
    "no-self-assign": WARN,
    "no-self-compare": WARN,
    "no-sequences": WARN,
    "no-shadow-restricted-names": WARN,
    "no-sparse-arrays": WARN,
    "no-template-curly-in-string": WARN,
    "no-this-before-super": WARN,
    "no-undef": ERROR,
    "no-unreachable": WARN,
    "no-unused-expressions": [
      WARN,
      {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true
      }
    ],
    "no-unused-labels": WARN,
    "no-unused-vars": [
      WARN,
      {
        args: "none",
        ignoreRestSiblings: true
      }
    ],
    "no-use-before-define": [
      WARN,
      { classes: false, functions: false, variables: false }
    ],
    "no-useless-computed-key": WARN,
    "no-useless-concat": WARN,
    "no-useless-constructor": WARN,
    "no-useless-escape": WARN,
    "no-useless-rename": [
      WARN,
      {
        ignoreDestructuring: false,
        ignoreImport: false,
        ignoreExport: false
      }
    ],
    "require-yield": WARN,
    "use-isnan": WARN,
    "valid-typeof": WARN,

    // import
    // https://github.com/benmosher/eslint-plugin-import/tree/main/docs/rules
    "import/first": ERROR,
    "import/no-amd": ERROR,
    "import/no-webpack-loader-syntax": ERROR,

    // react
    // https://github.com/yannickcr/eslint-plugin-react/tree/master/docs/rules
    "react/forbid-foreign-prop-types": [WARN, { allowInPropTypes: true }],
    "react/jsx-no-comment-textnodes": WARN,
    "react/jsx-no-duplicate-props": WARN,
    "react/jsx-no-target-blank": WARN,
    "react/jsx-no-undef": ERROR,
    "react/jsx-pascal-case": [WARN, { allowAllCaps: true, ignore: [] }],
    "react/jsx-uses-vars": WARN,
    "react/jsx-uses-react": WARN,
    "react/no-danger-with-children": WARN,
    "react/no-direct-mutation-state": WARN,
    "react/no-typos": ERROR,
    "react/require-render-return": ERROR,
    "react/style-prop-object": WARN,

    // react-hooks
    // https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks
    "react-hooks/exhaustive-deps": WARN,
    "react-hooks/rules-of-hooks": ERROR,

    // jsx-a11y
    // https://github.com/evcohen/eslint-plugin-jsx-a11y/tree/master/docs/rules
    "jsx-a11y/alt-text": WARN,
    "jsx-a11y/anchor-has-content": [WARN, { components: ["Link", "NavLink"] }],
    "jsx-a11y/anchor-is-valid": [WARN, { aspects: ["noHref", "invalidHref"] }],
    "jsx-a11y/aria-activedescendant-has-tabindex": WARN,
    "jsx-a11y/aria-props": WARN,
    "jsx-a11y/aria-proptypes": WARN,
    "jsx-a11y/aria-role": [WARN, { ignoreNonDOM: true }],
    "jsx-a11y/aria-unsupported-elements": WARN,
    "jsx-a11y/iframe-has-title": WARN,
    "jsx-a11y/img-redundant-alt": WARN,
    "jsx-a11y/lang": WARN,
    "jsx-a11y/no-access-key": WARN,
    "jsx-a11y/no-distracting-elements": WARN,
    "jsx-a11y/no-redundant-roles": WARN,
    "jsx-a11y/role-has-required-aria-props": WARN,
    "jsx-a11y/role-supports-aria-props": WARN,
    "jsx-a11y/scope": WARN
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
          jsx: true
        },
        warnOnUnsupportedTypeScriptVersion: true
      },
      plugins: ["@typescript-eslint"],
      rules: {
        "no-dupe-class-members": OFF,
        "no-undef": OFF,

        // Add TypeScript specific rules (and turn off ESLint equivalents)
        "@typescript-eslint/consistent-type-assertions": WARN,
        "no-array-constructor": OFF,
        "@typescript-eslint/no-array-constructor": WARN,

        // There is a bug w/ @typescript-eslint/no-duplicate-imports triggered
        // by multiple imports inside of module declarations. We should reenable
        // this rule when the bug is fixed.
        // https://github.com/typescript-eslint/typescript-eslint/issues/3071
        "no-duplicate-imports": OFF,
        // "@typescript-eslint/no-duplicate-imports": WARN,

        "no-redeclare": OFF,
        "@typescript-eslint/no-redeclare": ERROR,
        "no-use-before-define": OFF,
        "@typescript-eslint/no-use-before-define": [
          WARN,
          {
            functions: false,
            classes: false,
            variables: false,
            typedefs: false
          }
        ],
        "no-unused-expressions": OFF,
        "@typescript-eslint/no-unused-expressions": [
          WARN,
          {
            allowShortCircuit: true,
            allowTernary: true,
            allowTaggedTemplates: true
          }
        ],
        "no-unused-vars": OFF,
        "@typescript-eslint/no-unused-vars": [
          WARN,
          {
            args: "none",
            ignoreRestSiblings: true
          }
        ],
        "no-useless-constructor": OFF,
        "@typescript-eslint/no-useless-constructor": WARN
      }
    }
  ]
};
