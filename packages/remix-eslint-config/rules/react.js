// const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
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
  "react-hooks/rules-of-hooks": ERROR
};
