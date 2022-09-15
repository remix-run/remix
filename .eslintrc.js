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
        "import/no-extraneous-dependencies": 0,
      },
    },
  ],
};
