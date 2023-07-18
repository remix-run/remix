module.exports = {
  // TODO: These rules might be nice to enable... we should investigate eventually!
  "@typescript-eslint/array-type": "off",
  "@typescript-eslint/ban-ts-comment": "off",
  "@typescript-eslint/ban-types": "off",
  "@typescript-eslint/consistent-indexed-object-style": "off",
  "@typescript-eslint/consistent-type-definitions": "off",
  "@typescript-eslint/no-empty-function": "off",
  "@typescript-eslint/no-empty-interface": "off",
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/no-inferrable-types": "off",
  "@typescript-eslint/no-namespace": "off",
  "@typescript-eslint/no-non-null-assertion": "off",
  "@typescript-eslint/no-var-requires": "off",
  "@typescript-eslint/prefer-function-type": "off",
  "no-var": "off",
  "prefer-rest-params": "off",

  // These rules are nice and we want to configure over the defaults
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/no-use-before-define": [
    "error",
    {
      functions: false,
      classes: false,
      variables: false,
      typedefs: false,
    },
  ],
  "@typescript-eslint/no-unused-expressions": [
    "error",
    {
      allowShortCircuit: true,
      allowTernary: true,
      allowTaggedTemplates: true,
    },
  ],
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      args: "none",
      ignoreRestSiblings: true,
    },
  ],

  // These rules are turned on in the core rules but aren't needed for TypeScript code
  "no-dupe-class-members": "off",
  "no-undef": "off",

  // These stylistic rules don't match our preferences
  "no-use-before-define": "off",
  "prefer-const": "off",
};
