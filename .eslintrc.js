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
};
