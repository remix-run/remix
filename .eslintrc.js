const OFF = 0;
const WARN = 1;

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    require.resolve("./packages/remix-eslint-config/internal.js"),
    "plugin:markdown/recommended",
  ],
  plugins: ["markdown"],
  settings: {
    "import/internal-regex": "^~/",
  },
  overrides: [
    {
      files: ["**/*.md/**"],
      rules: {
        "import/no-extraneous-dependencies": OFF,
        "no-dupe-keys": OFF,
        "no-undef": OFF,
        "no-unused-expressions": OFF,
        "no-unused-vars": OFF,
        "@typescript-eslint/no-redeclare": OFF,
      },
    },
    {
      files: ["rollup.config.js"],
      rules: {
        "import/no-extraneous-dependencies": OFF,
      },
    },
    {
      files: [
        "**/*.md/*.js?(x)",
        "**/*.md/*.ts?(x)",
        "integration/helpers/cf-template/**/*.*",
        "integration/helpers/deno-template/**/*.*",
        "integration/helpers/node-template/**/*.*",
        "packages/remix-dev/config/defaults/**/*.*",
        "templates/**/*.*",
      ],
      rules: {
        "prefer-let/prefer-let": OFF,
        "prefer-const": WARN,

        "import/order": [
          WARN,
          {
            alphabetize: { caseInsensitive: true, order: "asc" },
            groups: ["builtin", "external", "internal", "parent", "sibling"],
            "newlines-between": "always",
          },
        ],

        "react/jsx-no-leaked-render": [WARN, { validStrategies: ["ternary"] }],
      },
    },
  ],
  // Report unused `eslint-disable` comments.
  reportUnusedDisableDirectives: true,
  // Tell ESLint not to ignore dot-files, which are ignored by default.
  ignorePatterns: ["!.*.js"],
};
