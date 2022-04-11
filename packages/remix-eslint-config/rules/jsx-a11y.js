// const OFF = 0;
const WARN = 1;
// const ERROR = 2;

module.exports = {
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
  "jsx-a11y/no-redundant-roles": WARN,
  "jsx-a11y/role-has-required-aria-props": WARN,
  "jsx-a11y/role-supports-aria-props": WARN,
};
