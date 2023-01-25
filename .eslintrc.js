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
  overrides: [
    {
      files: ["**/*.md/**"],
      rules: {
        "import/no-extraneous-dependencies": OFF,
        "no-dupe-keys": OFF,
        "no-undef": OFF,
        "no-unused-expressions": OFF,
        "no-unused-vars": OFF,
      },
    },
    {
      files: ["rollup.config.js"],
      rules: {
        "import/no-extraneous-dependencies": OFF,
      },
    },
    {
      files: ["templates/**/*.*"],
      rules: {
        "prefer-let/prefer-let": OFF,
        "prefer-const": WARN,
      },
    },
  ],
  // Report unused `eslint-disable` comments.
  reportUnusedDisableDirectives: true,
  // Tell ESLint not to ignore dot-files, which are ignored by default.
  ignorePatterns: ["!.*.js"],
};
